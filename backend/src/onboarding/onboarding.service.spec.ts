import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { authUser, prismaMock } from '../../test/helpers';
import { OnboardingService, stepStatus } from './onboarding.service';

describe('OnboardingService', () => {
  const collaborator = authUser('COLLABORATOR', { id: 'u-col', level: 1 });
  const editor = authUser('EDITOR', { id: 'u-edi' });
  let prisma: ReturnType<typeof prismaMock>;
  let audit: { log: jest.Mock };
  let mail: { sendRouteAssigned: jest.Mock };
  let service: OnboardingService;

  beforeEach(() => {
    prisma = prismaMock();
    audit = { log: jest.fn() };
    mail = { sendRouteAssigned: jest.fn().mockResolvedValue(true) };
    service = new OnboardingService(prisma, new AccessService(), audit as never, mail as never);
  });

  it('calcula el estado de cada paso según la versión confirmada (RF-14 y RF-16)', () => {
    expect(stepStatus(true, 100, [100])).toBe('READ');
    expect(stepStatus(true, 100, [90])).toBe('UPDATED');
    expect(stepStatus(true, 100, [])).toBe('PENDING');
    expect(stepStatus(false, 100, [100])).toBe('LOCKED');
  });

  it('arma la ruta del colaborador con el avance de la vista v_route_progress', async () => {
    const step = (id: number, order: number, isRequired = true) => ({
      stepOrder: order,
      isRequired,
      procedure: { id, code: `P-${id}`, title: `Paso ${id}`, status: 'ACTIVE', process: { code: 'P', name: 'Proceso' } },
    });
    prisma.routeAssignment.findMany.mockResolvedValue([
      {
        assignedAt: new Date('2026-11-02'),
        dueDate: new Date('2026-11-30'),
        route: { id: 2, name: 'Onboarding', description: null, area: { name: 'Operaciones' }, creator: { firstName: 'Diego', lastName: 'Muñoz' }, steps: [step(10, 1), step(11, 2), step(12, 3), step(13, 4, false)] },
      },
    ]);
    prisma.procedureVersion.findMany.mockResolvedValue([
      { id: 100, procedureId: 10, versionNumber: 2 },
      { id: 110, procedureId: 11, versionNumber: 1 },
      { id: 120, procedureId: 12, versionNumber: 3 },
      { id: 130, procedureId: 13, versionNumber: 1 },
    ]);
    prisma.readConfirmation.findMany.mockResolvedValue([
      { confirmedAt: new Date(), version: { id: 100, procedureId: 10, versionNumber: 2 } },
      { confirmedAt: new Date(), version: { id: 119, procedureId: 12, versionNumber: 2 } },
    ]);
    prisma.procedure.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]);
    prisma.$queryRaw.mockResolvedValue([{ routeId: 2, userId: 'u-col', required: 3, completed: 1, pct: 33.3 }]);

    const [route] = await service.myOnboarding(collaborator);
    expect(route.steps.map((item) => item.status)).toEqual(['READ', 'PENDING', 'UPDATED', 'LOCKED']);
    expect(route.steps[2].lastReadVersion).toBe(2);
    expect(route.progress?.pct).toBe(33.3);
    expect(route.optional).toEqual({ total: 1, completed: 0 });
  });

  describe('confirmación de lectura (RF-15)', () => {
    const version = { id: 50, status: 'PUBLISHED', versionNumber: 2, procedureId: 4, procedure: { code: 'OPE-P02-01' } };

    it('rechaza una versión inexistente o no publicada', async () => {
      prisma.procedureVersion.findUnique.mockResolvedValue({ ...version, status: 'DRAFT' });
      await expect(service.confirmRead(collaborator, 50, null)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza y audita un procedimiento sin acceso', async () => {
      prisma.procedureVersion.findUnique.mockResolvedValue(version);
      prisma.procedure.count.mockResolvedValue(0);
      await expect(service.confirmRead(collaborator, 50, null)).rejects.toBeInstanceOf(ForbiddenException);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACCESS_DENIED' }));
    });

    it('solo admite la versión vigente', async () => {
      prisma.procedureVersion.findUnique.mockResolvedValue(version);
      prisma.procedure.count.mockResolvedValue(1);
      prisma.procedureVersion.findMany.mockResolvedValue([{ id: 51, procedureId: 4, versionNumber: 3 }]);
      await expect(service.confirmRead(collaborator, 50, null)).rejects.toBeInstanceOf(ConflictException);
    });

    it('registra la confirmación una sola vez', async () => {
      const confirmedAt = new Date();
      prisma.procedureVersion.findUnique.mockResolvedValue(version);
      prisma.procedure.count.mockResolvedValue(1);
      prisma.procedureVersion.findMany.mockResolvedValue([{ id: 50, procedureId: 4, versionNumber: 2 }]);
      prisma.readConfirmation.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ confirmedAt });
      prisma.readConfirmation.create.mockResolvedValue({ confirmedAt });

      await expect(service.confirmRead(collaborator, 50, null)).resolves.toEqual({ versionId: 50, versionNumber: 2, confirmedAt });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONFIRM_READ' }), prisma);
      await service.confirmRead(collaborator, 50, null);
      expect(prisma.readConfirmation.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('rutas y asignaciones (RF-13)', () => {
    const routeDto = { name: 'Onboarding Operaciones', description: null, areaId: 1, isActive: true, steps: [{ procedureId: 1, isRequired: true }] };

    it('impide repetir un procedimiento en la ruta', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 1, isActive: true });
      const steps = [{ procedureId: 1, isRequired: true }, { procedureId: 1, isRequired: false }];
      await expect(service.createRoute(editor, { ...routeDto, steps }, null)).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('impide que un editor cree rutas de otra área o transversales', async () => {
      await expect(service.createRoute(editor, { ...routeDto, areaId: 2 }, null)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.createRoute(editor, { ...routeDto, areaId: null }, null)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('solo admite procedimientos publicados que el editor puede consultar', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 1, isActive: true });
      prisma.procedure.count.mockResolvedValue(0);
      await expect(service.createRoute(editor, routeDto, null)).rejects.toThrow('procedimientos publicados');
    });

    it('crea la ruta con sus pasos en orden', async () => {
      prisma.area.findUnique.mockResolvedValue({ id: 1, isActive: true });
      prisma.procedure.count.mockResolvedValue(2);
      prisma.onboardingRoute.create.mockResolvedValue({ id: 3, name: routeDto.name });
      const steps = [{ procedureId: 7, isRequired: true }, { procedureId: 5, isRequired: false }];
      await service.createRoute(editor, { ...routeDto, steps }, null);
      expect(prisma.onboardingRoute.create.mock.calls[0][0].data.steps.create).toEqual([
        { procedureId: 7, isRequired: true, stepOrder: 1 },
        { procedureId: 5, isRequired: false, stepOrder: 2 },
      ]);
    });

    it('impide que un editor asigne rutas a personas de otra área', async () => {
      prisma.onboardingRoute.findUnique.mockResolvedValue({ id: 2, areaId: 1, name: 'Onboarding' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u-otra', areaId: 2, isActive: true, role: { name: 'COLLABORATOR' }, accessLevel: { level: 1 } });
      await expect(service.assign(editor, 2, { userId: 'u-otra' }, null)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza asignar una ruta con pasos que la persona no puede leer', async () => {
      prisma.onboardingRoute.findUnique.mockResolvedValue({ id: 2, name: 'Onboarding', isActive: true, steps: [{ procedureId: 10 }, { procedureId: 11 }] });
      prisma.procedure.findMany.mockResolvedValueOnce([{ id: 10 }]).mockResolvedValueOnce([{ code: 'OPE-P02-02' }]);
      await expect(service.assertAssignable(2, collaborator)).rejects.toThrow('OPE-P02-02');
    });

    it('rechaza asignar una ruta inactiva', async () => {
      prisma.onboardingRoute.findUnique.mockResolvedValue({ id: 2, name: 'Onboarding', isActive: false, steps: [] });
      await expect(service.assertAssignable(2, collaborator)).rejects.toBeInstanceOf(ConflictException);
    });

    it('asigna la ruta con fecha límite y avisa por correo', async () => {
      const target = { id: 'u-col', email: 'ignacia.perez@empresa.test', firstName: 'Ignacia', lastName: 'Pérez', areaId: 1, isActive: true, role: { name: 'COLLABORATOR' }, accessLevel: { level: 1 } };
      prisma.onboardingRoute.findUnique
        .mockResolvedValueOnce({ id: 2, areaId: 1, name: 'Onboarding' })
        .mockResolvedValueOnce({ id: 2, name: 'Onboarding', isActive: true, steps: [{ procedureId: 10 }] });
      prisma.user.findUnique.mockResolvedValue(target);
      prisma.procedure.findMany.mockResolvedValue([{ id: 10 }]);
      await service.assign(editor, 2, { userId: 'u-col', dueDate: '2026-11-30' }, null);
      expect(prisma.routeAssignment.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { dueDate: new Date('2026-11-30') } }));
      expect(mail.sendRouteAssigned).toHaveBeenCalledWith(target, 'Onboarding', '2026-11-30');
    });
  });
});
