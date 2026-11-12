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
import { AuthUser, toAuthUser } from '../common/auth-user';
import { assertActiveArea } from '../common/catalog-checks';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignRouteDto, RouteDto } from './dto/onboarding.dto';

const stepSelect = {
  stepOrder: true,
  isRequired: true,
  procedure: { select: { id: true, code: true, title: true, status: true, process: { select: { code: true, name: true } } } },
} satisfies Prisma.RouteStepSelect;

interface ProgressRow {
  routeId: number;
  userId: string;
  required: number;
  completed: number;
  pct: number | null;
}

export type StepStatus = 'READ' | 'UPDATED' | 'PENDING' | 'LOCKED';

// UPDATED indica que confirmó una versión anterior y debe reconfirmar la vigente
export function stepStatus(readable: boolean, currentVersionId: number | undefined, readVersionIds: number[]): StepStatus {
  if (!readable) {
    return 'LOCKED';
  }
  if (currentVersionId !== undefined && readVersionIds.includes(currentVersionId)) {
    return 'READ';
  }
  return readVersionIds.length ? 'UPDATED' : 'PENDING';
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async listRoutes(user: AuthUser) {
    const routes = await this.prisma.onboardingRoute.findMany({
      where: this.access.manageableRouteWhere(user),
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        area: { select: { id: true, name: true } },
        steps: { select: { isRequired: true } },
        _count: { select: { assignments: true } },
      },
    });
    return routes.map(({ steps, _count, ...route }) => ({
      ...route,
      stepCount: steps.length,
      requiredCount: steps.filter((step) => step.isRequired).length,
      assignmentCount: _count.assignments,
    }));
  }

  async getRoute(user: AuthUser, id: number) {
    const route = await this.prisma.onboardingRoute.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        areaId: true,
        area: { select: { id: true, name: true } },
        creator: { select: { firstName: true, lastName: true } },
        steps: { orderBy: { stepOrder: 'asc' }, select: stepSelect },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          select: { assignedAt: true, dueDate: true, user: { select: { id: true, firstName: true, lastName: true, area: { select: { name: true } } } } },
        },
      },
    });
    if (!route) {
      throw new NotFoundException('La ruta no existe');
    }
    this.assertManage(user, route.areaId);
    const [current, progress] = await Promise.all([
      this.currentVersions(route.steps.map((step) => step.procedure.id)),
      this.progress(Prisma.sql`route_id = ${id}`),
    ]);
    return {
      ...route,
      steps: route.steps.map(({ procedure, ...step }) => ({
        ...step,
        procedureId: procedure.id,
        code: procedure.code,
        title: procedure.title,
        processName: procedure.process.name,
        active: procedure.status === 'ACTIVE',
        currentVersion: current.get(procedure.id)?.versionNumber ?? null,
      })),
      assignments: route.assignments.map((assignment) => ({
        ...assignment,
        progress: progress.find((row) => row.userId === assignment.user.id) ?? null,
      })),
    };
  }

  // Procedimientos publicados que el editor puede consultar y agregar como pasos
  procedureOptions(user: AuthUser) {
    return this.prisma.procedure.findMany({
      where: { ...this.access.procedureWhere(user), versions: { some: { status: 'PUBLISHED' } } },
      orderBy: [{ process: { code: 'asc' } }, { sortOrder: 'asc' }],
      select: {
        id: true,
        code: true,
        title: true,
        accessLevel: { select: { name: true, level: true } },
        process: { select: { code: true, name: true, area: { select: { name: true } } } },
      },
    });
  }

  async createRoute(user: AuthUser, dto: RouteDto, ip: string | null) {
    await this.assertRoute(user, dto);
    return this.prisma.$transaction(async (tx) => {
      const route = await tx.onboardingRoute.create({
        data: { ...this.routeData(dto), createdBy: user.id, steps: { create: this.stepsData(dto) } },
        select: { id: true, name: true },
      });
      await this.audit.log({ userId: user.id, action: 'CREATE', entity: 'onboarding_routes', entityId: route.id, details: { name: route.name }, ip }, tx);
      return route;
    });
  }

  async updateRoute(user: AuthUser, id: number, dto: RouteDto, ip: string | null) {
    const current = await this.prisma.onboardingRoute.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('La ruta no existe');
    }
    this.assertManage(user, current.areaId);
    await this.assertRoute(user, dto);
    return this.prisma.$transaction(async (tx) => {
      const route = await tx.onboardingRoute.update({ where: { id }, data: this.routeData(dto), select: { id: true, name: true } });
      await tx.routeStep.deleteMany({ where: { routeId: id } });
      await tx.routeStep.createMany({ data: this.stepsData(dto).map((step) => ({ ...step, routeId: id })) });
      await this.audit.log({ userId: user.id, action: 'UPDATE', entity: 'onboarding_routes', entityId: id, details: { name: route.name }, ip }, tx);
      return route;
    });
  }

  async assign(actor: AuthUser, routeId: number, dto: AssignRouteDto, ip: string | null) {
    const route = await this.prisma.onboardingRoute.findUnique({ where: { id: routeId } });
    if (!route) {
      throw new NotFoundException('La ruta no existe');
    }
    this.assertManage(actor, route.areaId);
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId }, include: { role: true, accessLevel: true } });
    if (!target?.isActive) {
      throw new UnprocessableEntityException('La persona no existe o está inactiva');
    }
    if (actor.role !== 'ADMIN' && target.areaId !== actor.areaId) {
      throw new ForbiddenException('Solo puedes asignar rutas a personas de tu área');
    }
    await this.assertAssignable(routeId, toAuthUser(target));
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.routeAssignment.upsert({
        where: { routeId_userId: { routeId, userId: target.id } },
        create: { routeId, userId: target.id, dueDate },
        update: { dueDate },
      });
      await this.audit.log(
        { userId: actor.id, action: 'ASSIGN', entity: 'onboarding_routes', entityId: routeId, details: { route: route.name, email: target.email, dueDate: dto.dueDate ?? null }, ip },
        tx,
      );
    });
    await this.mail.sendRouteAssigned(target, route.name, dto.dueDate ?? null);
    return { routeId, userId: target.id, dueDate: dto.dueDate ?? null };
  }

  // La ruta debe estar activa y la persona debe poder leer todos sus pasos obligatorios
  async assertAssignable(routeId: number, target: AuthUser) {
    const route = await this.prisma.onboardingRoute.findUnique({
      where: { id: routeId },
      select: { id: true, name: true, isActive: true, steps: { where: { isRequired: true }, select: { procedureId: true } } },
    });
    if (!route) {
      throw new UnprocessableEntityException('La ruta de onboarding no existe');
    }
    if (!route.isActive) {
      throw new ConflictException('La ruta de onboarding está inactiva');
    }
    const required = route.steps.map((step) => step.procedureId);
    const readable = await this.prisma.procedure.findMany({ where: { id: { in: required }, ...this.access.procedureWhere(target) }, select: { id: true } });
    if (readable.length !== required.length) {
      const missing = await this.prisma.procedure.findMany({
        where: { id: { in: required.filter((id) => !readable.some((item) => item.id === id)) } },
        select: { code: true },
      });
      throw new UnprocessableEntityException(`La persona no tiene acceso a: ${missing.map((item) => item.code).join(', ')}`);
    }
    return route;
  }

  async myOnboarding(user: AuthUser) {
    const assignments = await this.prisma.routeAssignment.findMany({
      where: { userId: user.id, route: { isActive: true } },
      orderBy: { assignedAt: 'desc' },
      select: {
        assignedAt: true,
        dueDate: true,
        route: {
          select: {
            id: true,
            name: true,
            description: true,
            area: { select: { name: true } },
            creator: { select: { firstName: true, lastName: true } },
            steps: { orderBy: { stepOrder: 'asc' }, select: stepSelect },
          },
        },
      },
    });
    const ids = [...new Set(assignments.flatMap((assignment) => assignment.route.steps.map((step) => step.procedure.id)))];
    const [current, confirmations, readable, progress] = await Promise.all([
      this.currentVersions(ids),
      this.prisma.readConfirmation.findMany({
        where: { userId: user.id, version: { procedureId: { in: ids } } },
        select: { confirmedAt: true, version: { select: { id: true, procedureId: true, versionNumber: true } } },
      }),
      this.prisma.procedure.findMany({ where: { id: { in: ids }, ...this.access.procedureWhere(user) }, select: { id: true } }),
      this.progress(Prisma.sql`user_id = ${user.id}::uuid`),
    ]);
    const readableIds = new Set(readable.map((item) => item.id));

    return assignments.map(({ route, ...assignment }) => {
      const steps = route.steps.map((step) => {
        const id = step.procedure.id;
        const mine = confirmations.filter((item) => item.version.procedureId === id);
        const currentVersion = current.get(id);
        const status = stepStatus(readableIds.has(id), currentVersion?.id, mine.map((item) => item.version.id));
        return {
          procedureId: id,
          code: step.procedure.code,
          title: step.procedure.title,
          processName: step.procedure.process.name,
          stepOrder: step.stepOrder,
          isRequired: step.isRequired,
          currentVersion: currentVersion?.versionNumber ?? null,
          status,
          confirmedAt: mine.find((item) => item.version.id === currentVersion?.id)?.confirmedAt ?? null,
          lastReadVersion: mine.length ? Math.max(...mine.map((item) => item.version.versionNumber)) : null,
        };
      });
      const optional = steps.filter((step) => !step.isRequired);
      return {
        ...assignment,
        route: { id: route.id, name: route.name, description: route.description, area: route.area, creator: route.creator },
        progress: progress.find((row) => row.routeId === route.id) ?? null,
        optional: { total: optional.length, completed: optional.filter((step) => step.status === 'READ').length },
        steps,
      };
    });
  }

  async confirmRead(user: AuthUser, versionId: number, ip: string | null) {
    const version = await this.prisma.procedureVersion.findUnique({
      where: { id: versionId },
      select: { id: true, status: true, versionNumber: true, procedureId: true, procedure: { select: { code: true } } },
    });
    if (!version || version.status !== 'PUBLISHED') {
      throw new NotFoundException('La versión no existe o no está publicada');
    }
    const readable = await this.prisma.procedure.count({ where: { id: version.procedureId, ...this.access.procedureWhere(user) } });
    if (!readable) {
      await this.audit.log({ userId: user.id, action: 'ACCESS_DENIED', entity: 'procedures', entityId: version.procedureId, ip });
      throw new ForbiddenException('No tienes acceso a este procedimiento');
    }
    const current = await this.currentVersions([version.procedureId]);
    if (current.get(version.procedureId)?.id !== versionId) {
      throw new ConflictException('Solo puedes confirmar la lectura de la versión vigente');
    }
    const existing = await this.prisma.readConfirmation.findUnique({ where: { userId_versionId: { userId: user.id, versionId } } });
    if (existing) {
      return { versionId, versionNumber: version.versionNumber, confirmedAt: existing.confirmedAt };
    }
    return this.prisma.$transaction(async (tx) => {
      const confirmation = await tx.readConfirmation.create({ data: { userId: user.id, versionId } });
      await this.audit.log(
        { userId: user.id, action: 'CONFIRM_READ', entity: 'procedure_versions', entityId: versionId, details: { code: version.procedure.code, version: version.versionNumber }, ip },
        tx,
      );
      return { versionId, versionNumber: version.versionNumber, confirmedAt: confirmation.confirmedAt };
    });
  }

  private async assertRoute(user: AuthUser, dto: RouteDto): Promise<void> {
    if (!this.access.canManageRoute(user, dto.areaId)) {
      throw new ForbiddenException('Solo puedes gestionar rutas de tu área');
    }
    if (dto.areaId !== null) {
      await assertActiveArea(this.prisma, dto.areaId);
    }
    const ids = dto.steps.map((step) => step.procedureId);
    if (new Set(ids).size !== ids.length) {
      throw new UnprocessableEntityException('Un procedimiento no puede repetirse en la ruta');
    }
    const valid = await this.prisma.procedure.count({
      where: { id: { in: ids }, ...this.access.procedureWhere(user), versions: { some: { status: 'PUBLISHED' } } },
    });
    if (valid !== ids.length) {
      throw new UnprocessableEntityException('Solo puedes agregar procedimientos publicados que puedas consultar');
    }
  }

  private assertManage(user: AuthUser, areaId: number | null): void {
    if (!this.access.canManageRoute(user, areaId)) {
      throw new ForbiddenException('Solo puedes gestionar rutas de tu área');
    }
  }

  private routeData(dto: RouteDto) {
    return { name: dto.name, description: dto.description ?? null, areaId: dto.areaId, isActive: dto.isActive };
  }

  // El orden de los pasos es el orden en que llegan
  private stepsData(dto: RouteDto) {
    return dto.steps.map((step, index) => ({ procedureId: step.procedureId, isRequired: step.isRequired, stepOrder: index + 1 }));
  }

  private async currentVersions(procedureIds: number[]) {
    const versions = await this.prisma.procedureVersion.findMany({
      where: { procedureId: { in: procedureIds }, status: 'PUBLISHED' },
      orderBy: [{ procedureId: 'asc' }, { versionNumber: 'desc' }],
      distinct: ['procedureId'],
      select: { id: true, procedureId: true, versionNumber: true },
    });
    return new Map(versions.map((version) => [version.procedureId, version]));
  }

  // El avance lo calcula la vista v_route_progress
  private progress(filter: Prisma.Sql): Promise<ProgressRow[]> {
    return this.prisma.$queryRaw<ProgressRow[]>`
      SELECT route_id AS "routeId", user_id AS "userId", required_steps::int AS required,
             completed_steps::int AS completed, progress_pct::float8 AS pct
      FROM v_route_progress
      WHERE ${filter}`;
  }
}
