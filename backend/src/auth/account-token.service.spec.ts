import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { prismaMock } from '../../test/helpers';
import { AccountTokenService } from './account-token.service';

describe('AccountTokenService', () => {
  const start = new Date('2026-11-20T10:00:00-03:00').getTime();
  const owner = { id: '00000000-0000-4000-8000-000000000003', passwordHash: 'hash-vigente' };
  const user = { ...owner, isActive: true };
  let prisma: ReturnType<typeof prismaMock>;
  let service: AccountTokenService;

  // jsonwebtoken calcula la emisión y el vencimiento con Date.now
  const at = (minutes: number) => jest.spyOn(Date, 'now').mockReturnValue(start + minutes * 60 * 1000);

  beforeEach(() => {
    prisma = prismaMock();
    prisma.user.findUnique.mockResolvedValue(user);
    const config = { getOrThrow: () => 'clave-de-pruebas-con-mas-de-treinta-y-dos-caracteres' };
    service = new AccountTokenService(new JwtService(), prisma, config as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('acepta un enlace de recuperación vigente', async () => {
    at(0);
    const token = await service.create(owner, 'reset');
    at(29);
    await expect(service.verify(token)).resolves.toEqual({ user, purpose: 'reset' });
  });

  it('rechaza un enlace de recuperación vencido después de 30 minutos (CP-04)', async () => {
    at(0);
    const token = await service.create(owner, 'reset');
    at(31);
    await expect(service.verify(token)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mantiene la invitación vigente durante 72 horas', async () => {
    at(0);
    const token = await service.create(owner, 'invite');
    at(71 * 60);
    await expect(service.verify(token)).resolves.toMatchObject({ purpose: 'invite' });
    at(73 * 60);
    await expect(service.verify(token)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invalida el enlace cuando la contraseña ya cambió (CP-03)', async () => {
    at(0);
    const token = await service.create(owner, 'reset');
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash: 'hash-nuevo' });
    await expect(service.verify(token)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un enlace de una cuenta desactivada', async () => {
    at(0);
    const token = await service.create(owner, 'reset');
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    await expect(service.verify(token)).rejects.toBeInstanceOf(BadRequestException);
  });
});
