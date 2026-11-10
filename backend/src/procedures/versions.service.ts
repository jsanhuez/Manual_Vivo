import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { MailService, VersionNotice } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RejectVersionDto, VersionContentDto } from './dto/procedure.dto';
import { ProceduresService } from './procedures.service';

const versionSelect = {
  id: true,
  procedureId: true,
  versionNumber: true,
  status: true,
  content: true,
  changeSummary: true,
  createdAt: true,
} satisfies Prisma.ProcedureVersionSelect;

const reviewSelect = {
  id: true,
  versionNumber: true,
  status: true,
  content: true,
  changeSummary: true,
  createdAt: true,
  author: { select: { firstName: true, lastName: true, email: true } },
  procedure: {
    select: {
      id: true,
      code: true,
      title: true,
      accessLevel: { select: { name: true } },
      process: { select: { id: true, code: true, name: true, area: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.ProcedureVersionSelect;

type ReviewVersion = Prisma.ProcedureVersionGetPayload<{ select: typeof reviewSelect }>;

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly procedures: ProceduresService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // Si hay un borrador se actualiza, si no se crea la versión siguiente (CU-11 flujo 4b)
  async saveDraft(user: AuthUser, procedureId: number, dto: VersionContentDto, ip: string | null) {
    const procedure = await this.procedures.loadForManage(user, procedureId);
    if (procedure.status !== 'ACTIVE') {
      throw new ConflictException('El procedimiento está archivado');
    }

    return this.prisma.$transaction(async (tx) => {
      const open = await tx.procedureVersion.findFirst({
        where: { procedureId, status: { in: ['DRAFT', 'IN_REVIEW'] } },
      });
      if (open?.status === 'IN_REVIEW') {
        throw new ConflictException(`La versión ${open.versionNumber} está en revisión. Espera la decisión del administrador`);
      }

      if (open) {
        const version = await tx.procedureVersion.update({
          where: { id: open.id },
          data: { content: dto.content, changeSummary: dto.changeSummary },
          select: versionSelect,
        });
        await this.audit.log(
          { userId: user.id, action: 'UPDATE', entity: 'procedure_versions', entityId: version.id, details: { code: procedure.code, version: version.versionNumber }, ip },
          tx,
        );
        return version;
      }

      const last = await tx.procedureVersion.aggregate({ where: { procedureId }, _max: { versionNumber: true } });
      const version = await tx.procedureVersion.create({
        data: {
          procedureId,
          authorId: user.id,
          versionNumber: (last._max.versionNumber ?? 0) + 1,
          content: dto.content,
          changeSummary: dto.changeSummary,
        },
        select: versionSelect,
      });
      await this.audit.log(
        { userId: user.id, action: 'CREATE', entity: 'procedure_versions', entityId: version.id, details: { code: procedure.code, version: version.versionNumber }, ip },
        tx,
      );
      return version;
    });
  }

  async submit(user: AuthUser, versionId: number, ip: string | null) {
    const version = await this.prisma.procedureVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundException('La versión no existe');
    }
    const procedure = await this.procedures.loadForManage(user, version.procedureId);
    if (version.status !== 'DRAFT') {
      throw new ConflictException('Solo se puede enviar a revisión una versión en borrador');
    }

    const submitted = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.procedureVersion.update({
        where: { id: versionId },
        data: { status: 'IN_REVIEW' },
        select: versionSelect,
      });
      await this.audit.log(
        { userId: user.id, action: 'SUBMIT', entity: 'procedure_versions', entityId: versionId, details: { code: procedure.code, version: updated.versionNumber }, ip },
        tx,
      );
      return updated;
    });
    await this.notifications.reviewRequested({
      procedureId: procedure.id,
      code: procedure.code,
      title: procedure.title,
      versionNumber: submitted.versionNumber,
      changeSummary: submitted.changeSummary,
    });
    return submitted;
  }

  async listInReview() {
    const versions = await this.prisma.procedureVersion.findMany({
      where: { status: 'IN_REVIEW' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        versionNumber: true,
        changeSummary: true,
        createdAt: true,
        author: { select: { firstName: true, lastName: true } },
        procedure: { select: { id: true, code: true, title: true, process: { select: { code: true, name: true, area: { select: { id: true, name: true } } } } } },
      },
    });
    const submits = await this.prisma.auditLog.findMany({
      where: { action: 'SUBMIT', entity: 'procedure_versions', entityId: { in: versions.map((version) => String(version.id)) } },
      orderBy: { createdAt: 'asc' },
      select: { entityId: true, createdAt: true },
    });
    const submittedAt = new Map(submits.map((submit) => [submit.entityId, submit.createdAt]));
    return versions.map((version) => ({ ...version, submittedAt: submittedAt.get(String(version.id)) ?? version.createdAt }));
  }

  async reviewDetail(versionId: number) {
    const { author, ...version } = await this.findInReview(versionId);
    const [currentVersion, impact] = await Promise.all([
      this.prisma.procedureVersion.findFirst({
        where: { procedureId: version.procedure.id, status: 'PUBLISHED' },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true, content: true, publishedAt: true },
      }),
      this.notifications.audience(version.procedure.id),
    ]);
    return { ...version, author: { firstName: author.firstName, lastName: author.lastName }, currentVersion, impact };
  }

  async publish(user: AuthUser, versionId: number, ip: string | null) {
    const version = await this.findInReview(versionId);
    const impact = await this.notifications.audience(version.procedure.id);
    const published = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.procedureVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', reviewerId: user.id, publishedAt: new Date() },
        select: versionSelect,
      });
      await this.audit.log(
        {
          userId: user.id,
          action: 'PUBLISH',
          entity: 'procedure_versions',
          entityId: versionId,
          details: { code: version.procedure.code, version: version.versionNumber, affected: impact.users },
          ip,
        },
        tx,
      );
      return updated;
    });
    const notified = await this.notifications.versionPublished(this.notice(version));
    return { ...published, notified };
  }

  async reject(user: AuthUser, versionId: number, dto: RejectVersionDto, ip: string | null) {
    const version = await this.findInReview(versionId);
    const rejected = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.procedureVersion.update({
        where: { id: versionId },
        data: { status: 'REJECTED', reviewerId: user.id, reviewNotes: dto.reviewNotes },
        select: versionSelect,
      });
      await this.audit.log(
        { userId: user.id, action: 'REJECT', entity: 'procedure_versions', entityId: versionId, details: { code: version.procedure.code, version: version.versionNumber }, ip },
        tx,
      );
      return updated;
    });
    await this.mail.sendVersionRejected(version.author, { ...this.notice(version), reviewNotes: dto.reviewNotes });
    return rejected;
  }

  private async findInReview(versionId: number): Promise<ReviewVersion> {
    const version = await this.prisma.procedureVersion.findUnique({ where: { id: versionId }, select: reviewSelect });
    if (!version) {
      throw new NotFoundException('La versión no existe');
    }
    if (version.status !== 'IN_REVIEW') {
      throw new ConflictException('La versión ya no está en revisión');
    }
    return version;
  }

  private notice(version: ReviewVersion): VersionNotice {
    return {
      procedureId: version.procedure.id,
      code: version.procedure.code,
      title: version.procedure.title,
      versionNumber: version.versionNumber,
      changeSummary: version.changeSummary,
    };
  }
}
