import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AccountTokenService } from '../auth/account-token.service';
import { BCRYPT_COST } from '../auth/password.policy';
import { AuthUser, RoleName } from '../common/auth-user';
import { accessLevelValue, assertActiveArea } from '../common/catalog-checks';
import { MailService } from '../mail/mail.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, CreateUserDto, ListUsersQueryDto, NewUserDto, UpdateProfileDto, UpdateUserDto } from './dto/user.dto';
import { adminUserSelect, presentAdminUser, profileSelect } from './user.select';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tokens: AccountTokenService,
    private readonly mail: MailService,
    private readonly onboarding: OnboardingService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
    return user;
  }

  updateProfile(actor: AuthUser, dto: UpdateProfileDto, ip: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: actor.id },
        data: { firstName: dto.firstName, lastName: dto.lastName, jobTitle: dto.jobTitle ?? null },
        select: profileSelect,
      });
      await this.audit.log({ userId: actor.id, action: 'UPDATE', entity: 'users', entityId: actor.id, details: { scope: 'profile' }, ip }, tx);
      return user;
    });
  }

  async changePassword(actor: AuthUser, dto: ChangePasswordDto, ip: string | null): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!user.passwordHash || !(await compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    if (await compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual');
    }
    const passwordHash = await hash(dto.newPassword, BCRYPT_COST);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.id }, data: { passwordHash } });
      await this.audit.log({ userId: actor.id, action: 'PASSWORD_CHANGE', entity: 'users', entityId: actor.id, ip }, tx);
    });
  }

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      areaId: query.areaId,
      roleId: query.roleId,
      ...(query.status === 'active' && { isActive: true, passwordHash: { not: null } }),
      ...(query.status === 'inactive' && { isActive: false }),
      ...(query.status === 'pending' && { isActive: true, passwordHash: null }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const users = await this.prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    return users.map(presentAdminUser);
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: adminUserSelect });
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
    return presentAdminUser(user);
  }

  async create(dto: NewUserDto, actor: AuthUser, ip: string | null) {
    await assertActiveArea(this.prisma, dto.areaId);
    const route = dto.routeId ? await this.onboarding.assertAssignable(dto.routeId, await this.futureUser(dto)) : null;
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          jobTitle: dto.jobTitle ?? null,
          hireDate: new Date(dto.hireDate),
          areaId: dto.areaId,
          roleId: dto.roleId,
          accessLevelId: dto.accessLevelId,
        },
        select: adminUserSelect,
      });
      await this.audit.log(
        {
          userId: actor.id,
          action: 'CREATE',
          entity: 'users',
          entityId: created.id,
          details: { email: created.email, role: created.role.name, area: created.area.name, level: created.accessLevel.name },
          ip,
        },
        tx,
      );
      if (route) {
        await tx.routeAssignment.create({
          data: { routeId: route.id, userId: created.id, dueDate: dto.routeDueDate ? new Date(dto.routeDueDate) : null },
        });
        await this.audit.log(
          { userId: actor.id, action: 'ASSIGN', entity: 'onboarding_routes', entityId: route.id, details: { route: route.name, email: created.email, dueDate: dto.routeDueDate ?? null }, ip },
          tx,
        );
      }
      return created;
    });
    const invitationSent = await this.sendInvitation(user, route?.name);
    return { ...presentAdminUser(user), invitationSent };
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser, ip: string | null) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: adminUserSelect });
    if (!before) {
      throw new NotFoundException('El usuario no existe');
    }
    if (id === actor.id) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (dto.isActive === false || role?.name !== 'ADMIN') {
        throw new BadRequestException('No puedes desactivar tu cuenta ni quitarte el rol de administrador');
      }
    }
    if (dto.areaId !== before.area.id) {
      await assertActiveArea(this.prisma, dto.areaId);
    }

    return this.prisma.$transaction(async (tx) => {
      const after = await tx.user.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          jobTitle: dto.jobTitle ?? null,
          hireDate: new Date(dto.hireDate),
          areaId: dto.areaId,
          roleId: dto.roleId,
          accessLevelId: dto.accessLevelId,
          isActive: dto.isActive ?? before.isActive,
        },
        select: adminUserSelect,
      });
      const changes = permissionChanges(before, after);
      await this.audit.log(
        {
          userId: actor.id,
          action: Object.keys(changes).length ? 'PERMISSION_CHANGE' : 'UPDATE',
          entity: 'users',
          entityId: id,
          details: { email: after.email, changes },
          ip,
        },
        tx,
      );
      return presentAdminUser(after);
    });
  }

  async resendInvitation(id: string, actor: AuthUser, ip: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: adminUserSelect });
    if (!user) {
      throw new NotFoundException('El usuario no existe');
    }
    if (!user.isActive) {
      throw new ConflictException('La cuenta está desactivada');
    }
    if (user.passwordHash) {
      throw new ConflictException('El usuario ya activó su cuenta');
    }
    if (!(await this.sendInvitation(user))) {
      throw new ServiceUnavailableException('No se pudo enviar el correo. Intenta nuevamente en unos minutos');
    }
    await this.audit.log({ userId: actor.id, action: 'INVITE', entity: 'users', entityId: id, details: { email: user.email }, ip });
    return { message: 'Se envió una nueva invitación' };
  }

  // Responsables posibles de un proceso: personas activas del área y administradores
  options(actor: AuthUser, areaId?: number) {
    const area = actor.role === 'ADMIN' ? areaId : actor.areaId;
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(area && { OR: [{ areaId: area }, { role: { name: 'ADMIN' } }] }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        area: { select: { id: true, name: true } },
        role: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  private async sendInvitation(user: { id: string; email: string; firstName: string }, routeName?: string): Promise<boolean> {
    const token = await this.tokens.create({ id: user.id, passwordHash: null }, 'invite');
    return this.mail.sendInvitation(user, token, routeName);
  }

  // Permisos de la cuenta nueva para validar su ruta
  private async futureUser(dto: CreateUserDto): Promise<AuthUser> {
    const [role, level] = await Promise.all([this.prisma.role.findUnique({ where: { id: dto.roleId } }), accessLevelValue(this.prisma, dto.accessLevelId)]);
    if (!role) {
      throw new UnprocessableEntityException('El rol no existe');
    }
    return { id: '', email: dto.email, firstName: dto.firstName, lastName: dto.lastName, role: role.name as RoleName, areaId: dto.areaId, level };
  }
}

type AdminUser = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

function permissionChanges(before: AdminUser, after: AdminUser) {
  const pairs: Record<string, [string | boolean, string | boolean]> = {
    area: [before.area.name, after.area.name],
    role: [before.role.name, after.role.name],
    level: [before.accessLevel.name, after.accessLevel.name],
    isActive: [before.isActive, after.isActive],
  };
  return Object.fromEntries(
    Object.entries(pairs)
      .filter(([, [from, to]]) => from !== to)
      .map(([field, [from, to]]) => [field, { from, to }]),
  );
}
