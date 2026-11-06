import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { VersionContentDto } from './dto/procedure.dto';
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

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly procedures: ProceduresService,
    private readonly audit: AuditService,
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

    return this.prisma.$transaction(async (tx) => {
      const submitted = await tx.procedureVersion.update({
        where: { id: versionId },
        data: { status: 'IN_REVIEW' },
        select: versionSelect,
      });
      await this.audit.log(
        { userId: user.id, action: 'SUBMIT', entity: 'procedure_versions', entityId: versionId, details: { code: procedure.code, version: submitted.versionNumber }, ip },
        tx,
      );
      return submitted;
    });
  }
}
