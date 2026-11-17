import { prismaMock } from '../../test/helpers';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const notice = { procedureId: 4, code: 'OPE-P02-01', title: 'Programar un retiro', versionNumber: 3, changeSummary: 'Se agrega un paso' };
  let prisma: ReturnType<typeof prismaMock>;
  let mail: { sendVersionPublished: jest.Mock; sendReviewRequested: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    prisma = prismaMock();
    mail = { sendVersionPublished: jest.fn().mockResolvedValue(true), sendReviewRequested: jest.fn().mockResolvedValue(true) };
    service = new NotificationsService(prisma, mail as never);
  });

  it('avisa a cada persona pendiente de reconfirmar según la vista (RF-16, CP-19)', async () => {
    const pending = [
      { email: 'ignacia.perez@empresa.test', firstName: 'Ignacia' },
      { email: 'diego.munoz@empresa.test', firstName: 'Diego' },
    ];
    prisma.$queryRaw.mockResolvedValue(pending);
    await expect(service.versionPublished(notice)).resolves.toBe(2);
    expect(mail.sendVersionPublished).toHaveBeenCalledTimes(2);
    expect(mail.sendVersionPublished).toHaveBeenCalledWith(pending[0], notice);
  });

  it('no falla si un correo no se puede enviar', async () => {
    prisma.$queryRaw.mockResolvedValue([{ email: 'a@empresa.test', firstName: 'A' }]);
    mail.sendVersionPublished.mockRejectedValue(new Error('sin conexión'));
    await expect(service.versionPublished(notice)).resolves.toBe(1);
  });

  it('avisa a los administradores activos cuando hay una versión en revisión', async () => {
    prisma.user.findMany.mockResolvedValue([{ email: 'valentina.soto@empresa.test', firstName: 'Valentina' }]);
    await service.reviewRequested(notice);
    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({ isActive: true, role: { name: 'ADMIN' } });
    expect(mail.sendReviewRequested).toHaveBeenCalledTimes(1);
  });

  it('calcula el impacto de publicar una versión', async () => {
    prisma.$queryRaw.mockResolvedValue([{ users: 3, routes: 1 }]);
    await expect(service.audience(4)).resolves.toEqual({ users: 3, routes: 1 });
  });
});
