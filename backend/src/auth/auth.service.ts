import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser, SessionPayload } from '../common/auth-user';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { profileSelect } from '../users/user.select';
import { AccountTokenService } from './account-token.service';
import { LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { BCRYPT_COST } from './password.policy';

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

// Comparar contra un hash ficticio evita revelar por el tiempo de respuesta si el correo existe
const DUMMY_HASH = hashSync(randomBytes(16).toString('hex'), BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly tokens: AccountTokenService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(dto: LoginDto, ip: string | null) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (await this.isLocked(dto.email, user?.lastLoginAt ?? null)) {
      await this.audit.log({ action: 'LOGIN_BLOCKED', entity: 'users', entityId: user?.id, details: { email: dto.email }, ip });
      throw new HttpException('Demasiados intentos fallidos. Intenta nuevamente en 15 minutos', HttpStatus.TOO_MANY_REQUESTS);
    }

    const passwordMatches = await compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !passwordMatches) {
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'users', entityId: user?.id, details: { email: dto.email }, ip });
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tu cuenta está desactivada. Contacta al administrador');
    }

    const profile = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: profileSelect,
    });
    await this.audit.log({ userId: user.id, action: 'LOGIN', entity: 'users', entityId: user.id, ip });

    const payload: SessionPayload = { sub: user.id, typ: 'session' };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, expiresIn: SESSION_TTL_SECONDS, user: profile };
  }

  async logout(user: AuthUser, ip: string | null): Promise<void> {
    await this.audit.log({ userId: user.id, action: 'LOGOUT', entity: 'users', entityId: user.id, ip });
  }

  async forgotPassword(email: string, ip: string | null) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.isActive) {
      const token = await this.tokens.create(user, 'reset');
      await this.mail.sendPasswordReset(user, token);
      await this.audit.log({ userId: user.id, action: 'PASSWORD_RESET_REQUEST', entity: 'users', entityId: user.id, ip });
    }
    // La respuesta es la misma exista o no la cuenta para no revelar qué correos están registrados
    return { message: 'Si el correo está registrado, recibirás un enlace válido por 30 minutos' };
  }

  async verifyAccountToken(token: string) {
    const { user, purpose } = await this.tokens.verify(token);
    return { purpose, email: user.email, firstName: user.firstName };
  }

  async resetPassword(dto: ResetPasswordDto, ip: string | null) {
    const { user, purpose } = await this.tokens.verify(dto.token);
    const passwordHash = await hash(dto.password, BCRYPT_COST);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
      await this.audit.log(
        {
          userId: user.id,
          action: purpose === 'invite' ? 'INVITATION_ACCEPTED' : 'PASSWORD_RESET',
          entity: 'users',
          entityId: user.id,
          ip,
        },
        tx,
      );
    });
    return {
      message:
        purpose === 'invite'
          ? 'Tu cuenta quedó activa. Ya puedes iniciar sesión'
          : 'Tu contraseña fue actualizada. Ya puedes iniciar sesión',
    };
  }

  // Cuenta los intentos fallidos de los últimos 15 minutos posteriores al último ingreso exitoso
  private async isLocked(email: string, lastLoginAt: Date | null): Promise<boolean> {
    const windowStart = new Date(Date.now() - LOCK_WINDOW_MS);
    const since = lastLoginAt && lastLoginAt > windowStart ? lastLoginAt : windowStart;
    const failures = await this.prisma.auditLog.count({
      where: { action: 'LOGIN_FAILED', createdAt: { gt: since }, details: { path: ['email'], equals: email } },
    });
    return failures >= MAX_FAILED_ATTEMPTS;
  }
}
