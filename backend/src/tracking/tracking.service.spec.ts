import { AccessService } from '../access/access.service';
import { authUser, prismaMock } from '../../test/helpers';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let service: TrackingService;

  beforeEach(() => {
    prisma = prismaMock();
    prisma.$queryRaw.mockResolvedValue([]);
    service = new TrackingService(prisma, new AccessService());
  });

  it('entrega el avance de las rutas desde la vista v_route_progress (RF-17)', async () => {
    const rows = [{ routeId: 2, userId: 'u-col', required: 3, completed: 1, pct: 33.3 }];
    prisma.$queryRaw.mockResolvedValue(rows);
    await expect(service.routes(authUser('ADMIN'))).resolves.toEqual(rows);
    const sql = prisma.$queryRaw.mock.calls[0][0].join('?');
    expect(sql).toContain('FROM v_route_progress');
  });

  it('limita la cobertura del editor a los procedimientos que gestiona', async () => {
    prisma.procedure.findMany.mockResolvedValue([]);
    await expect(service.coverage(authUser('EDITOR'))).resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    prisma.procedure.findMany.mockResolvedValue([{ id: 4 }, { id: 5 }]);
    await service.coverage(authUser('EDITOR'));
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('calcula la cobertura del administrador sobre todos los procedimientos', async () => {
    await service.coverage(authUser('ADMIN'));
    expect(prisma.procedure.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw.mock.calls[0][0].join('?')).toContain('v_current_versions');
  });
});
