import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RoleName } from '../src/common/auth-user';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../src/common/decorators';
import { PrismaService } from '../src/prisma/prisma.service';

type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Endpoint {
  verb: Verb;
  path: string;
  roles?: RoleName[];
  isPublic: boolean;
}

const collaborator = {
  id: '00000000-0000-4000-8000-000000000003',
  email: 'ignacia.perez@empresa.test',
  firstName: 'Ignacia',
  lastName: 'Pérez',
  areaId: 1,
  isActive: true,
  role: { name: 'COLLABORATOR' },
  accessLevel: { level: 1 },
};

// Se leen las rutas desde los controladores para cubrir el 100% de los endpoints sin una lista manual
function listEndpoints(app: NestExpressApplication): Endpoint[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const endpoints: Endpoint[] = [];
  for (const { instance, metatype } of discovery.getControllers()) {
    if (!instance || !metatype) {
      continue;
    }
    const base = Reflect.getMetadata(PATH_METADATA, metatype) as string;
    for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
      const handler = (instance as Record<string, unknown>)[name] as object;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (path === undefined || method === undefined) {
        continue;
      }
      const segments = ['api', base, path].map((part) => part.replace(/^\/|\/$/g, '')).filter(Boolean);
      endpoints.push({
        verb: RequestMethod[method].toLowerCase() as Verb,
        path: `/${segments.join('/')}`.replace(/:\w+/g, '1'),
        roles: reflector.getAllAndOverride<RoleName[] | undefined>(ROLES_KEY, [handler as never, metatype]),
        isPublic: !!reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler as never, metatype]),
      });
    }
  }
  return endpoints;
}

describe('Seguridad de los endpoints (OE4 y RNF-03)', () => {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(collaborator) },
    auditLog: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    $disconnect: jest.fn(),
    onModuleDestroy: jest.fn(),
  };
  let app: NestExpressApplication;
  let endpoints: Endpoint[];
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app);
    await app.init();
    endpoints = listEndpoints(app);
    token = await app.get(JwtService).signAsync({ sub: collaborator.id, typ: 'session' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('encuentra los endpoints de todos los módulos', () => {
    expect(endpoints.length).toBeGreaterThan(50);
    expect(endpoints.filter((endpoint) => endpoint.isPublic).map((endpoint) => endpoint.path)).toEqual(
      expect.arrayContaining(['/api/health', '/api/auth/login', '/api/auth/forgot-password']),
    );
  });

  it('responde 401 sin sesión en el 100% de los endpoints protegidos', async () => {
    const protectedEndpoints = endpoints.filter((endpoint) => !endpoint.isPublic);
    const failures: string[] = [];
    for (const { verb, path } of protectedEndpoints) {
      const response = await request(app.getHttpServer())[verb](path);
      if (response.status !== 401) {
        failures.push(`${verb.toUpperCase()} ${path} respondió ${response.status}`);
      }
    }
    expect(failures).toEqual([]);
    expect(protectedEndpoints.length).toBeGreaterThan(45);
  });

  it('responde 401 con un token inválido', async () => {
    await request(app.getHttpServer()).get('/api/users/me').set('Authorization', 'Bearer token-falso').expect(401);
  });

  it('responde 403 a un colaborador en el 100% de los endpoints restringidos por rol', async () => {
    const restricted = endpoints.filter((endpoint) => endpoint.roles && !endpoint.roles.includes('COLLABORATOR'));
    const failures: string[] = [];
    for (const { verb, path } of restricted) {
      const response = await request(app.getHttpServer())[verb](path).set('Authorization', `Bearer ${token}`);
      if (response.status !== 403) {
        failures.push(`${verb.toUpperCase()} ${path} respondió ${response.status}`);
      }
    }
    expect(failures).toEqual([]);
    expect(restricted.length).toBeGreaterThan(30);
  });

  it('limita a 20 por minuto los intentos de inicio de sesión desde una misma IP (RNF-03)', async () => {
    const limit = Number(process.env.AUTH_THROTTLE_LIMIT);
    const body = { email: 'ignacia.perez@empresa.test', password: 'Incorrecta2026!' };
    for (let attempt = 1; attempt <= limit; attempt++) {
      await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(401);
    }
    await request(app.getHttpServer()).post('/api/auth/login').send(body).expect(429);
  });

  it('mantiene público solo el estado del servicio y el acceso a la cuenta', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    const publicPaths = endpoints.filter((endpoint) => endpoint.isPublic).map((endpoint) => endpoint.path);
    expect(publicPaths.every((path) => path === '/api/health' || path.startsWith('/api/auth/'))).toBe(true);
  });
});
