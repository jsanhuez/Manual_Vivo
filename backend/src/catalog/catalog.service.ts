import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { AccessLevelDto, AreaDto } from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listRoles() {
    return this.prisma.role.findMany({ orderBy: { id: 'asc' } });
  }

  async listAreas() {
    const areas = await this.prisma.area.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: { where: { isActive: true } }, processes: { where: { status: 'ACTIVE' } } } },
      },
    });
    return areas.map(({ _count, ...area }) => ({
      ...area,
      activeUsers: _count.users,
      activeProcesses: _count.processes,
    }));
  }

  createArea(dto: AreaDto, actor: AuthUser, ip: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.create({
        data: { name: dto.name, description: dto.description ?? null, isActive: dto.isActive ?? true },
      });
      await this.audit.log({ userId: actor.id, action: 'CREATE', entity: 'areas', entityId: area.id, details: { name: area.name }, ip }, tx);
      return area;
    });
  }

  async updateArea(id: number, dto: AreaDto, actor: AuthUser, ip: string | null) {
    const area = await this.prisma.area.findUnique({ where: { id } });
    if (!area) {
      throw new NotFoundException('El área no existe');
    }
    if (dto.isActive === false && area.isActive) {
      const activeUsers = await this.prisma.user.count({ where: { areaId: id, isActive: true } });
      if (activeUsers > 0) {
        throw new ConflictException(`No se puede desactivar el área porque tiene ${activeUsers} usuarios activos`);
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.area.update({
        where: { id },
        data: { name: dto.name, description: dto.description ?? null, isActive: dto.isActive ?? area.isActive },
      });
      await this.audit.log(
        { userId: actor.id, action: 'UPDATE', entity: 'areas', entityId: id, details: { name: updated.name, isActive: updated.isActive }, ip },
        tx,
      );
      return updated;
    });
  }

  async listAccessLevels() {
    const levels = await this.prisma.accessLevel.findMany({
      orderBy: { level: 'asc' },
      include: { _count: { select: { users: true, processes: true, procedures: true } } },
    });
    return levels.map(({ _count, ...level }) => ({
      ...level,
      users: _count.users,
      contents: _count.processes + _count.procedures,
    }));
  }

  createAccessLevel(dto: AccessLevelDto, actor: AuthUser, ip: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const level = await tx.accessLevel.create({
        data: { name: dto.name, level: dto.level, description: dto.description ?? null },
      });
      await this.audit.log(
        { userId: actor.id, action: 'CREATE', entity: 'access_levels', entityId: level.id, details: { name: level.name, level: level.level }, ip },
        tx,
      );
      return level;
    });
  }

  async updateAccessLevel(id: number, dto: AccessLevelDto, actor: AuthUser, ip: string | null) {
    await this.findAccessLevel(id);
    return this.prisma.$transaction(async (tx) => {
      const level = await tx.accessLevel.update({
        where: { id },
        data: { name: dto.name, level: dto.level, description: dto.description ?? null },
      });
      await this.audit.log(
        { userId: actor.id, action: 'UPDATE', entity: 'access_levels', entityId: id, details: { name: level.name, level: level.level }, ip },
        tx,
      );
      return level;
    });
  }

  // La tabla no tiene estado activo, por eso un nivel solo se elimina si nadie lo usa
  async deleteAccessLevel(id: number, actor: AuthUser, ip: string | null): Promise<void> {
    const level = await this.findAccessLevel(id);
    const inUse = level._count.users + level._count.processes + level._count.procedures;
    if (inUse > 0) {
      throw new ConflictException(`No se puede eliminar el nivel porque está asignado a ${inUse} usuarios o contenidos`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.accessLevel.delete({ where: { id } });
      await this.audit.log({ userId: actor.id, action: 'DELETE', entity: 'access_levels', entityId: id, details: { name: level.name }, ip }, tx);
    });
  }

  private async findAccessLevel(id: number) {
    const level = await this.prisma.accessLevel.findUnique({
      where: { id },
      include: { _count: { select: { users: true, processes: true, procedures: true } } },
    });
    if (!level) {
      throw new NotFoundException('El nivel de acceso no existe');
    }
    return level;
  }
}
