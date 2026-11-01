import type { AccessLevel, Role, User } from '@prisma/client';

export const ROLE_NAMES = ['COLLABORATOR', 'EDITOR', 'ADMIN'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  areaId: number;
  level: number;
}

export interface SessionPayload {
  sub: string;
  typ: 'session';
}

export function toAuthUser(user: User & { role: Role; accessLevel: AccessLevel }): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role.name as RoleName,
    areaId: user.areaId,
    level: user.accessLevel.level,
  };
}
