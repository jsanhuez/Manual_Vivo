import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, SessionPayload, toAuthUser } from '../auth-user';
import { IS_PUBLIC_KEY } from '../decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Debes iniciar sesión');
    }

    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('La sesión expiró o no es válida');
    }
    if (payload.typ !== 'session') {
      throw new UnauthorizedException('La sesión expiró o no es válida');
    }

    // Se consulta el usuario en cada solicitud para que una desactivación o un cambio de rol rija de inmediato
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true, accessLevel: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('La cuenta no está activa');
    }
    request.user = toAuthUser(user);
    return true;
  }
}
