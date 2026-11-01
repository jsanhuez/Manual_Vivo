import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, RoleName } from './auth-user';
import { clientIp } from './client-ip';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  return context.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});

export const ClientIp = createParamDecorator((_data: unknown, context: ExecutionContext): string | null => {
  return clientIp(context.switchToHttp().getRequest<Request>());
});
