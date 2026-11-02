import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export type AccountTokenPurpose = 'reset' | 'invite';

const TOKEN_TTL_SECONDS: Record<AccountTokenPurpose, number> = {
  reset: 30 * 60,
  invite: 72 * 60 * 60,
};

type TokenOwner = Pick<User, 'id' | 'passwordHash'>;

const invalidLink = () =>
  new BadRequestException('El enlace no es válido, ya fue utilizado o expiró. Solicita uno nuevo');

@Injectable()
export class AccountTokenService {
  private readonly secret: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
  }

  create(user: TokenOwner, purpose: AccountTokenPurpose): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, typ: purpose },
      { secret: this.secretFor(user), expiresIn: TOKEN_TTL_SECONDS[purpose] },
    );
  }

  async verify(token: string): Promise<{ user: User; purpose: AccountTokenPurpose }> {
    const decoded = this.jwt.decode<{ sub?: string; typ?: string } | null>(token);
    const purpose = decoded?.typ;
    if (!decoded?.sub || !isUUID(decoded.sub) || (purpose !== 'reset' && purpose !== 'invite')) {
      throw invalidLink();
    }
    const user = await this.prisma.user.findUnique({ where: { id: decoded.sub } });
    if (!user || !user.isActive) {
      throw invalidLink();
    }
    try {
      await this.jwt.verifyAsync(token, { secret: this.secretFor(user) });
    } catch {
      throw invalidLink();
    }
    return { user, purpose };
  }

  // El hash vigente forma parte de la firma, así el enlace deja de servir cuando cambia la contraseña
  secretFor(user: TokenOwner): string {
    return `${this.secret}:${user.passwordHash ?? 'pending'}`;
  }
}
