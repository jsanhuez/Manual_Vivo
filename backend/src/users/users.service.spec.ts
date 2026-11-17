import { BadRequestException, ConflictException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { authUser, prismaMock } from '../../test/helpers';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const admin = authUser('ADMIN', { id: 'u-admin' });
  const newUser = {
    firstName: 'Sofía',
    lastName: 'Contreras',
    email: 'sofia.contreras@empresa.test',
    jobTitle: null,
    hireDate: '2026-11-23',
    areaId: 1,
    roleId: 1,
    accessLevelId: 1,
  };
  const created = {
    id: 'u-new',
    email: newUser.email,
    firstName: 'Sofía',
    passwordHash: null,
    role: { name: 'COLLABORATOR' },
    area: { name: 'Operaciones' },
    accessLevel: { name: 'General' },
  };
  let prisma: ReturnType<typeof prismaMock>;
  let audit: { log: jest.Mock };
  let mail: { sendInvitation: jest.Mock };
  let onboarding: { assertAssignable: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prisma = prismaMock();
    audit = { log: jest.fn() };
    mail = { sendInvitation: jest.fn().mockResolvedValue(true) };
    onboarding = { assertAssignable: jest.fn() };
    const tokens = { create: jest.fn().mockResolvedValue('token') };
    service = new UsersService(prisma, audit as never, tokens as never, mail as never, onboarding as never);
  });

  it('rechaza el cambio de contraseña si la actual no coincide (CP-05)', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: hashSync('Correcta2026!', 4) });
    await expect(service.changePassword(admin, { currentPassword: 'Incorrecta2026!', newPassword: 'NuevaClave2026!' }, null)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige una contraseña nueva distinta de la actual', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({ passwordHash: hashSync('Correcta2026!', 4) });
    await expect(service.changePassword(admin, { currentPassword: 'Correcta2026!', newPassword: 'Correcta2026!' }, null)).rejects.toThrow('distinta');
  });

  it('impide que el administrador se desactive a sí mismo', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...created, id: admin.id, isActive: true, area: { id: 1, name: 'Operaciones' } });
    prisma.role.findUnique.mockResolvedValue({ name: 'ADMIN' });
    await expect(service.update(admin.id, { ...newUser, isActive: false }, admin, null)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea la cuenta con su ruta de onboarding y la menciona en la invitación (RF-04 y RF-13)', async () => {
    prisma.area.findUnique.mockResolvedValue({ id: 1, isActive: true });
    prisma.role.findUnique.mockResolvedValue({ name: 'COLLABORATOR' });
    prisma.accessLevel.findUnique.mockResolvedValue({ level: 1 });
    prisma.user.create.mockResolvedValue(created);
    onboarding.assertAssignable.mockResolvedValue({ id: 2, name: 'Onboarding Operaciones' });

    const result = await service.create({ ...newUser, routeId: 2, routeDueDate: '2026-12-15' }, admin, null);
    expect(onboarding.assertAssignable).toHaveBeenCalledWith(2, expect.objectContaining({ role: 'COLLABORATOR', areaId: 1, level: 1 }));
    expect(prisma.routeAssignment.create).toHaveBeenCalledWith({ data: { routeId: 2, userId: 'u-new', dueDate: new Date('2026-12-15') } });
    expect(mail.sendInvitation).toHaveBeenCalledWith(created, 'token', 'Onboarding Operaciones');
    expect(result).toMatchObject({ invitationPending: true, invitationSent: true });
  });

  it('informa cuando no se pudo enviar la invitación al reenviarla', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...created, isActive: true });
    mail.sendInvitation.mockResolvedValue(false);
    await expect(service.resendInvitation('u-new', admin, null)).rejects.toMatchObject({ status: 503 });
  });

  it('no reenvía la invitación a una cuenta que ya está activa', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...created, isActive: true, passwordHash: 'hash' });
    await expect(service.resendInvitation('u-new', admin, null)).rejects.toBeInstanceOf(ConflictException);
  });
});
