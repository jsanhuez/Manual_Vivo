import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { accessLevelValue } from '../common/catalog-checks';
import { StatusDto } from '../processes/dto/process.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcedureDto, ManageProceduresQueryDto, ProcedureMetaDto } from './dto/procedure.dto';

const authorSelect = { select: { firstName: true, lastName: true } } satisfies Prisma.UserDefaultArgs;

const versionSummarySelect = {
  id: true,
  versionNumber: true,
  status: true,
  changeSummary: true,
  reviewNotes: true,
  createdAt: true,
  publishedAt: true,
  author: authorSelect,
} satisfies Prisma.ProcedureVersionSelect;

@Injectable()
export class ProceduresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async getVisible(user: AuthUser, id: number, ip: string | null) {
    const procedure = await this.findReadable(user, id, ip);
    const canManage = this.canManage(user, procedure);
    const published = procedure.versions.filter((version) => version.status === 'PUBLISHED');
    const current = published[0];
    if (!current && !canManage) {
      throw new NotFoundException('El procedimiento aún no tiene una versión publicada');
    }
    const content = current
      ? await this.prisma.procedureVersion.findUniqueOrThrow({ where: { id: current.id }, select: { content: true } })
      : null;

    const { versions, process, accessLevel, ...rest } = procedure;
    return {
      ...rest,
      accessLevel,
      process: { id: process.id, code: process.code, name: process.name, area: process.area, owner: process.owner },
      currentVersion: current ? { ...current, content: content?.content ?? '' } : null,
      history: published,
      canManage,
      // Los borradores, revisiones y rechazos solo los ve quien gestiona el procedimiento
      workflow: canManage ? versions.filter((version) => version.status !== 'PUBLISHED') : [],
    };
  }

  async getVersion(user: AuthUser, id: number, versionNumber: number, ip: string | null) {
    const procedure = await this.findReadable(user, id, ip);
    const version = await this.prisma.procedureVersion.findUnique({
      where: { procedureId_versionNumber: { procedureId: id, versionNumber } },
      select: { ...versionSummarySelect, content: true },
    });
    if (!version || (version.status !== 'PUBLISHED' && !this.canManage(user, procedure))) {
      throw new NotFoundException('La versión no existe');
    }
    const current = procedure.versions.find((item) => item.status === 'PUBLISHED');
    return { ...version, isCurrent: current?.id === version.id };
  }

  async listManageable(user: AuthUser, query: ManageProceduresQueryDto) {
    const procedures = await this.prisma.procedure.findMany({
      where: { AND: [this.access.manageableProcedureWhere(user), query.processId ? { processId: query.processId } : {}] },
      orderBy: [{ process: { code: 'asc' } }, { sortOrder: 'asc' }],
      select: {
        id: true,
        code: true,
        title: true,
        sortOrder: true,
        status: true,
        accessLevel: { select: { id: true, name: true, level: true } },
        process: { select: { id: true, code: true, name: true, status: true, area: { select: { id: true, name: true } } } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: { id: true, versionNumber: true, status: true, createdAt: true, publishedAt: true },
        },
      },
    });
    return procedures.map(({ versions, ...procedure }) => ({
      ...procedure,
      currentVersion: versions.find((version) => version.status === 'PUBLISHED') ?? null,
      openVersion: versions.find((version) => version.status === 'DRAFT' || version.status === 'IN_REVIEW') ?? null,
      latestVersion: versions[0] ?? null,
    }));
  }

  async getForEdit(user: AuthUser, id: number) {
    const procedure = await this.loadForManage(user, id);
    const editSelect = { ...versionSummarySelect, content: true } satisfies Prisma.ProcedureVersionSelect;
    const [openVersion, currentVersion, latest] = await Promise.all([
      this.prisma.procedureVersion.findFirst({ where: { procedureId: id, status: { in: ['DRAFT', 'IN_REVIEW'] } }, select: editSelect }),
      this.prisma.procedureVersion.findFirst({
        where: { procedureId: id, status: 'PUBLISHED' },
        orderBy: { versionNumber: 'desc' },
        select: editSelect,
      }),
      this.prisma.procedureVersion.findFirst({ where: { procedureId: id }, orderBy: { versionNumber: 'desc' }, select: versionSummarySelect }),
    ]);
    return {
      id: procedure.id,
      code: procedure.code,
      title: procedure.title,
      sortOrder: procedure.sortOrder,
      status: procedure.status,
      accessLevelId: procedure.accessLevelId,
      process: { id: procedure.process.id, code: procedure.process.code, name: procedure.process.name },
      openVersion,
      currentVersion,
      lastRejection: latest?.status === 'REJECTED' ? latest : null,
    };
  }

  async create(user: AuthUser, dto: CreateProcedureDto, ip: string | null) {
    const process = await this.prisma.process.findUnique({ where: { id: dto.processId }, include: { accessLevel: true } });
    if (!process) {
      throw new UnprocessableEntityException('El proceso no existe');
    }
    if (process.status !== 'ACTIVE') {
      throw new ConflictException('El proceso está archivado');
    }
    const level = await accessLevelValue(this.prisma, dto.accessLevelId);
    if (!this.access.canManage(user, process.areaId, [process.accessLevel.level, level])) {
      throw new ForbiddenException('Solo puedes crear procedimientos en procesos de tu área y con un nivel que puedas consultar');
    }

    return this.prisma.$transaction(async (tx) => {
      const procedure = await tx.procedure.create({
        data: {
          processId: dto.processId,
          code: dto.code,
          title: dto.title,
          sortOrder: dto.sortOrder,
          accessLevelId: dto.accessLevelId,
          versions: {
            create: { authorId: user.id, versionNumber: 1, content: dto.content, changeSummary: dto.changeSummary },
          },
        },
        select: { id: true, code: true, title: true, versions: { select: { id: true, versionNumber: true, status: true } } },
      });
      await this.audit.log({ userId: user.id, action: 'CREATE', entity: 'procedures', entityId: procedure.id, details: { code: procedure.code }, ip }, tx);
      const { versions, ...rest } = procedure;
      return { ...rest, openVersion: versions[0] };
    });
  }

  async updateMeta(user: AuthUser, id: number, dto: ProcedureMetaDto, ip: string | null) {
    const procedure = await this.loadForManage(user, id);
    const level = await accessLevelValue(this.prisma, dto.accessLevelId);
    if (!this.access.canManage(user, procedure.process.areaId, [procedure.process.accessLevel.level, level])) {
      throw new ForbiddenException('No puedes asignar un nivel de acceso superior al tuyo');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.procedure.update({
        where: { id },
        data: { code: dto.code, title: dto.title, sortOrder: dto.sortOrder, accessLevelId: dto.accessLevelId },
        select: { id: true, code: true, title: true, sortOrder: true, accessLevelId: true },
      });
      await this.audit.log({ userId: user.id, action: 'UPDATE', entity: 'procedures', entityId: id, details: { code: updated.code }, ip }, tx);
      return updated;
    });
  }

  async setStatus(user: AuthUser, id: number, dto: StatusDto, ip: string | null) {
    await this.loadForManage(user, id);
    return this.prisma.$transaction(async (tx) => {
      const procedure = await tx.procedure.update({ where: { id }, data: { status: dto.status }, select: { id: true, code: true, status: true } });
      const action = dto.status === 'ARCHIVED' ? 'ARCHIVE' : 'RESTORE';
      await this.audit.log({ userId: user.id, action, entity: 'procedures', entityId: id, details: { code: procedure.code }, ip }, tx);
      return procedure;
    });
  }

  async loadForManage(user: AuthUser, id: number) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id },
      include: { accessLevel: true, process: { include: { accessLevel: true } } },
    });
    if (!procedure) {
      throw new NotFoundException('El procedimiento no existe');
    }
    if (!this.canManage(user, procedure)) {
      throw new ForbiddenException('Solo puedes gestionar procedimientos de tu área');
    }
    return procedure;
  }

  private canManage(
    user: AuthUser,
    procedure: { accessLevel: { level: number }; process: { areaId: number; accessLevel: { level: number } } },
  ): boolean {
    return this.access.canManage(user, procedure.process.areaId, [procedure.accessLevel.level, procedure.process.accessLevel.level]);
  }

  private async findReadable(user: AuthUser, id: number, ip: string | null) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id, status: 'ACTIVE', process: { status: 'ACTIVE' } },
      select: {
        id: true,
        code: true,
        title: true,
        sortOrder: true,
        accessLevel: { select: { id: true, name: true, level: true } },
        process: {
          select: {
            id: true,
            code: true,
            name: true,
            areaId: true,
            accessLevel: { select: { level: true } },
            area: { select: { id: true, name: true } },
            owner: authorSelect,
          },
        },
        versions: { orderBy: { versionNumber: 'desc' }, select: versionSummarySelect },
      },
    });
    if (!procedure) {
      throw new NotFoundException('El procedimiento no existe');
    }
    const allowed = await this.prisma.procedure.count({ where: { AND: [{ id }, this.access.procedureWhere(user)] } });
    if (!allowed) {
      await this.audit.log({ userId: user.id, action: 'ACCESS_DENIED', entity: 'procedures', entityId: id, ip });
      throw new ForbiddenException('No tienes acceso a este procedimiento');
    }
    return procedure;
  }
}
