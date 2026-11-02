import { Prisma } from '@prisma/client';

export const profileSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  jobTitle: true,
  hireDate: true,
  isActive: true,
  lastLoginAt: true,
  area: { select: { id: true, name: true } },
  role: { select: { id: true, name: true } },
  accessLevel: { select: { id: true, name: true, level: true } },
} satisfies Prisma.UserSelect;

export const adminUserSelect = { ...profileSelect, passwordHash: true } satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

// Informa si la invitación sigue pendiente sin exponer el hash de la contraseña
export function presentAdminUser({ passwordHash, ...user }: AdminUserRow) {
  return { ...user, invitationPending: passwordHash === null };
}
