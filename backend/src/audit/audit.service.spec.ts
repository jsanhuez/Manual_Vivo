import { prismaMock } from '../../test/helpers';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let service: AuditService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new AuditService(prisma);
  });

  it('registra la acción con usuario, entidad e IP (RF-18)', async () => {
    await service.log({ userId: 'u-1', action: 'PUBLISH', entity: 'procedure_versions', entityId: 9, details: { code: 'OPE-P02-01' }, ip: '10.0.0.1' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', action: 'PUBLISH', entity: 'procedure_versions', entityId: '9', details: { code: 'OPE-P02-01' }, ipAddress: '10.0.0.1' },
    });
  });

  it('filtra por usuario, acción y fechas y pagina los resultados', async () => {
    prisma.auditLog.findMany.mockResolvedValue([{ id: BigInt(42), action: 'LOGIN' }]);
    prisma.auditLog.count.mockResolvedValue(21);
    const from = '2026-11-20T03:00:00.000Z';
    const to = '2026-11-23T03:00:00.000Z';
    const page = await service.list({ userId: 'u-1', action: 'LOGIN', from, to, page: 2 });

    const query = prisma.auditLog.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ userId: 'u-1', action: 'LOGIN', createdAt: { gte: new Date(from), lt: new Date(to) } });
    expect(query.skip).toBe(20);
    expect(page).toMatchObject({ total: 21, page: 2, pageSize: 20 });
    expect(page.items[0].id).toBe('42');
  });
});
