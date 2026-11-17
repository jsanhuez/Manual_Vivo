import { AuthUser, RoleName } from '../src/common/auth-user';

const MODELS = [
  'user',
  'role',
  'accessLevel',
  'area',
  'process',
  'processVisibility',
  'processRelation',
  'procedure',
  'procedureVersion',
  'onboardingRoute',
  'routeStep',
  'routeAssignment',
  'readConfirmation',
  'auditLog',
];

const METHODS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findMany',
  'create',
  'createMany',
  'update',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
];

// Prisma simulado: cada método es un jest.fn y la transacción recibe el mismo objeto
export function prismaMock(): any {
  const prisma: any = { $queryRaw: jest.fn(), $transaction: jest.fn() };
  for (const model of MODELS) {
    prisma[model] = Object.fromEntries(METHODS.map((method) => [method, jest.fn()]));
  }
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as Promise<unknown>[]),
  );
  return prisma;
}

export function authUser(role: RoleName, overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: 'u-actor', email: 'actor@empresa.test', firstName: 'Actor', lastName: 'Prueba', role, areaId: 1, level: 2, ...overrides };
}
