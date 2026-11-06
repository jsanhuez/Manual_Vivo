import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { accessLevelValue, assertActiveArea, latestDate } from '../common/catalog-checks';
import { PrismaService } from '../prisma/prisma.service';
import { ListProcessesQueryDto, ProcessDto, StatusDto } from './dto/process.dto';

const summarySelect = {
  id: true,
  code: true,
  name: true,
  objective: true,
  scope: true,
  isCrossArea: true,
  status: true,
  updatedAt: true,
  area: { select: { id: true, name: true } },
  accessLevel: { select: { id: true, name: true, level: true } },
  owner: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ProcessSelect;

const latestPublished = {
  where: { status: 'PUBLISHED' },
  orderBy: { versionNumber: 'desc' },
  take: 1,
} satisfies Prisma.Procedure$versionsArgs;

@Injectable()
export class ProcessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  async listVisible(user: AuthUser, query: ListProcessesQueryDto) {
    const filters: Prisma.ProcessWhereInput = {
      ...(query.areaId && { areaId: query.areaId }),
      ...(query.crossArea && { isCrossArea: true }),
    };
    const [processes, total] = await Promise.all([
      this.prisma.process.findMany({
        where: { AND: [this.access.processWhere(user), filters] },
        orderBy: { code: 'asc' },
        select: {
          ...summarySelect,
          procedures: {
            where: this.readableProcedures(user),
            select: { versions: { ...latestPublished, select: { publishedAt: true } } },
          },
        },
      }),
      this.prisma.process.count({ where: { status: 'ACTIVE', ...filters } }),
    ]);
    return {
      items: processes.map(({ procedures, ...process }) => ({
        ...process,
        procedureCount: procedures.length,
        lastUpdatedAt: latestDate([process.updatedAt, ...procedures.map((p) => p.versions[0]?.publishedAt)]),
      })),
      // Se informa cuántos procesos quedan fuera sin revelar cuáles son
      hiddenCount: total - processes.length,
    };
  }

  async getVisible(user: AuthUser, id: number, ip: string | null) {
    const process = await this.prisma.process.findFirst({
      where: { id, status: 'ACTIVE' },
      select: {
        ...summarySelect,
        areaId: true,
        visibility: { select: { area: { select: { id: true, name: true } } } },
        procedures: {
          where: this.readableProcedures(user),
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            code: true,
            title: true,
            sortOrder: true,
            accessLevel: { select: { id: true, name: true, level: true } },
            versions: { ...latestPublished, select: { versionNumber: true, changeSummary: true, publishedAt: true } },
          },
        },
      },
    });
    if (!process) {
      throw new NotFoundException('El proceso no existe');
    }
    const allowed = await this.prisma.process.count({ where: { AND: [{ id }, this.access.processWhere(user)] } });
    if (!allowed) {
      await this.audit.log({ userId: user.id, action: 'ACCESS_DENIED', entity: 'processes', entityId: id, ip });
      throw new ForbiddenException('No tienes acceso a este proceso');
    }
    const { visibility, procedures, areaId, ...rest } = process;
    return {
      ...rest,
      visibleAreas: visibility.map((item) => item.area),
      procedures: procedures.map(({ versions, ...procedure }) => ({ ...procedure, currentVersion: versions[0] ?? null })),
      canManage: this.access.canManage(user, areaId, [process.accessLevel.level]),
    };
  }

  async listManageable(user: AuthUser) {
    const processes = await this.prisma.process.findMany({
      where: this.access.manageableProcessWhere(user),
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
      select: {
        ...summarySelect,
        visibility: { select: { area: { select: { id: true, name: true } } } },
        _count: { select: { procedures: true } },
      },
    });
    return processes.map(({ visibility, _count, ...process }) => ({
      ...process,
      visibleAreas: visibility.map((item) => item.area),
      procedureCount: _count.procedures,
    }));
  }

  async getForEdit(user: AuthUser, id: number) {
    const process = await this.prisma.process.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        objective: true,
        scope: true,
        areaId: true,
        ownerId: true,
        accessLevelId: true,
        isCrossArea: true,
        status: true,
        accessLevel: { select: { level: true } },
        visibility: { select: { areaId: true } },
      },
    });
    if (!process) {
      throw new NotFoundException('El proceso no existe');
    }
    this.assertManage(user, process.areaId, process.accessLevel.level, 'Solo puedes modificar procesos de tu área');
    const { accessLevel, visibility, ...rest } = process;
    return { ...rest, visibleAreaIds: visibility.map((item) => item.areaId) };
  }

  async create(user: AuthUser, dto: ProcessDto, ip: string | null) {
    const level = await accessLevelValue(this.prisma, dto.accessLevelId);
    this.assertManage(user, dto.areaId, level, 'Solo puedes registrar procesos de tu área con un nivel que puedas consultar');
    await assertActiveArea(this.prisma, dto.areaId);
    await this.assertOwner(dto.ownerId, dto.areaId);

    return this.prisma.$transaction(async (tx) => {
      const process = await tx.process.create({
        data: {
          ...this.processData(dto),
          visibility: { create: this.extraAreas(dto).map((areaId) => ({ areaId })) },
        },
        select: { id: true, code: true, name: true },
      });
      await this.audit.log({ userId: user.id, action: 'CREATE', entity: 'processes', entityId: process.id, details: { code: process.code }, ip }, tx);
      return process;
    });
  }

  async update(user: AuthUser, id: number, dto: ProcessDto, ip: string | null) {
    const current = await this.prisma.process.findUnique({ where: { id }, include: { accessLevel: true } });
    if (!current) {
      throw new NotFoundException('El proceso no existe');
    }
    this.assertManage(user, current.areaId, current.accessLevel.level, 'Solo puedes modificar procesos de tu área');
    const level = await accessLevelValue(this.prisma, dto.accessLevelId);
    this.assertManage(user, dto.areaId, level, 'No puedes trasladar el proceso a otra área ni asignarle un nivel superior al tuyo');
    if (dto.areaId !== current.areaId) {
      await assertActiveArea(this.prisma, dto.areaId);
    }
    await this.assertOwner(dto.ownerId, dto.areaId);

    return this.prisma.$transaction(async (tx) => {
      const process = await tx.process.update({
        where: { id },
        data: this.processData(dto),
        select: { id: true, code: true, name: true },
      });
      await tx.processVisibility.deleteMany({ where: { processId: id } });
      await tx.processVisibility.createMany({ data: this.extraAreas(dto).map((areaId) => ({ processId: id, areaId })) });
      await this.audit.log({ userId: user.id, action: 'UPDATE', entity: 'processes', entityId: id, details: { code: process.code }, ip }, tx);
      return process;
    });
  }

  async setStatus(user: AuthUser, id: number, dto: StatusDto, ip: string | null) {
    const current = await this.prisma.process.findUnique({ where: { id }, include: { accessLevel: true } });
    if (!current) {
      throw new NotFoundException('El proceso no existe');
    }
    this.assertManage(user, current.areaId, current.accessLevel.level, 'Solo puedes modificar procesos de tu área');
    return this.prisma.$transaction(async (tx) => {
      const process = await tx.process.update({
        where: { id },
        data: { status: dto.status },
        select: { id: true, code: true, status: true },
      });
      const action = dto.status === 'ARCHIVED' ? 'ARCHIVE' : 'RESTORE';
      await this.audit.log({ userId: user.id, action, entity: 'processes', entityId: id, details: { code: process.code }, ip }, tx);
      return process;
    });
  }

  // Solo se cuentan y listan procedimientos que el usuario puede leer y que ya tienen una versión publicada
  private readableProcedures(user: AuthUser): Prisma.ProcedureWhereInput {
    return { ...this.access.procedureLevelWhere(user), versions: { some: { status: 'PUBLISHED' } } };
  }

  private processData(dto: ProcessDto) {
    return {
      code: dto.code,
      name: dto.name,
      objective: dto.objective,
      scope: dto.scope ?? null,
      areaId: dto.areaId,
      ownerId: dto.ownerId,
      accessLevelId: dto.accessLevelId,
      isCrossArea: dto.isCrossArea,
    };
  }

  // Un proceso transversal ya es visible para todas las áreas, por eso no guarda áreas adicionales
  private extraAreas(dto: ProcessDto): number[] {
    if (dto.isCrossArea) {
      return [];
    }
    return [...new Set(dto.visibleAreaIds)].filter((areaId) => areaId !== dto.areaId);
  }

  private assertManage(user: AuthUser, areaId: number, level: number, message: string): void {
    if (!this.access.canManage(user, areaId, [level])) {
      throw new ForbiddenException(message);
    }
  }

  private async assertOwner(ownerId: string, areaId: number): Promise<void> {
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId }, include: { role: true } });
    if (!owner?.isActive || (owner.areaId !== areaId && owner.role.name !== 'ADMIN')) {
      throw new UnprocessableEntityException('El responsable debe ser una persona activa del área o un administrador');
    }
  }
}
