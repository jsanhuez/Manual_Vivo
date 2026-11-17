import { UnauthorizedException } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { prismaMock } from '../../test/helpers';
import { AuthService, MAX_FAILED_ATTEMPTS } from './auth.service';

describe('AuthService', () => {
  const password = 'ManualVivo2026!';
  const user = {
    id: 'u-1',
    email: 'ignacia.perez@empresa.test',
    firstName: 'Ignacia',
    passwordHash: hashSync(password, 4),
    isActive: true,
    lastLoginAt: null,
  };
  let prisma: ReturnType<typeof prismaMock>;
  let audit: { log: jest.Mock };
  let mail: { sendPasswordReset: jest.Mock };
  let tokens: { create: jest.Mock; verify: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = prismaMock();
    prisma.auditLog.count.mockResolvedValue(0);
    audit = { log: jest.fn() };
    mail = { sendPasswordReset: jest.fn().mockResolvedValue(true) };
    tokens = { create: jest.fn().mockResolvedValue('enlace'), verify: jest.fn() };
    const jwt = { signAsync: jest.fn().mockResolvedValue('token-de-sesion') };
    service = new AuthService(prisma, jwt as never, tokens as never, audit as never, mail as never);
  });

  it('inicia sesión con credenciales válidas y registra LOGIN (CP-01)', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue({ id: user.id });
    const result = await service.login({ email: user.email, password }, '10.0.0.1');
    expect(result.accessToken).toBe('token-de-sesion');
    expect(result.expiresIn).toBe(8 * 60 * 60);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN', userId: user.id }));
  });

  it('rechaza una contraseña incorrecta y registra LOGIN_FAILED (CP-02)', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(service.login({ email: user.email, password: 'Incorrecta2026!' }, null)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED' }));
  });

  it('responde igual cuando el correo no existe', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login({ email: 'nadie@empresa.test', password }, null)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bloquea el acceso tras cinco intentos fallidos en 15 minutos (RNF-03)', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.auditLog.count.mockResolvedValue(MAX_FAILED_ATTEMPTS);
    await expect(service.login({ email: user.email, password }, null)).rejects.toMatchObject({ status: 429 });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_BLOCKED' }));
  });

  it('rechaza una cuenta desactivada aunque la contraseña sea correcta', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });
    await expect(service.login({ email: user.email, password }, null)).rejects.toThrow('desactivada');
  });

  it('no revela si un correo está registrado al recuperar la contraseña (RF-02)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await service.forgotPassword('nadie@empresa.test', null);
    expect(result.message).toContain('Si el correo está registrado');
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('envía el enlace de recuperación a una cuenta activa (CP-03)', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await service.forgotPassword(user.email, null);
    expect(tokens.create).toHaveBeenCalledWith(user, 'reset');
    expect(mail.sendPasswordReset).toHaveBeenCalledWith(user, 'enlace');
  });

  it('restablece la contraseña con un enlace válido', async () => {
    tokens.verify.mockResolvedValue({ user, purpose: 'reset' });
    const result = await service.resetPassword({ token: 'enlace', password: 'NuevaClave2026!' }, null);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id } }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_RESET' }), prisma);
    expect(result.message).toContain('contraseña fue actualizada');
  });

  it('activa la cuenta con el enlace de invitación', async () => {
    tokens.verify.mockResolvedValue({ user, purpose: 'invite' });
    const result = await service.resetPassword({ token: 'enlace', password: 'NuevaClave2026!' }, null);
    expect(result.message).toContain('cuenta quedó activa');
  });
});
