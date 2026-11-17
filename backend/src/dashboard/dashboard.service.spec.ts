import { AccessService } from '../access/access.service';
import { authUser, prismaMock } from '../../test/helpers';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let prisma: ReturnType<typeof prismaMock>;
  let service: DashboardService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new DashboardService(prisma, new AccessService());
    prisma.procedure.findMany.mockResolvedValue([
      { processId: 1, process: { areaId: 1 } },
      { processId: 1, process: { areaId: 1 } },
      { processId: 2, process: { areaId: 2 } },
    ]);
    const publication = (id: number, versionNumber: number) => ({ versionNumber, procedure: { id }, publishedAt: new Date(), changeSummary: 'Cambio' });
    prisma.procedureVersion.findMany.mockResolvedValue([publication(4, 2), publication(4, 1), publication(5, 1)]);
  });

  it('resume el contenido visible, las lecturas pendientes y el onboarding del colaborador (RF-14 y RF-16)', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ procedureId: 4, changed: true }]).mockResolvedValueOnce([{ routeId: 2, pct: 33.3 }]);
    const summary = await service.summary(authUser('COLLABORATOR'));
    expect(summary.stats).toEqual({ procedures: 3, processes: 2, areas: 2 });
    expect(summary.recentUpdates.map((update) => update.procedure.id)).toEqual([4, 5]);
    expect(summary.pendingReads).toEqual([{ procedureId: 4, changed: true }]);
    expect(summary.onboarding).toEqual([{ routeId: 2, pct: 33.3 }]);
    expect(summary.management).toBeNull();
  });

  it('agrega borradores, versiones en revisión y revisiones pendientes para el administrador', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.procedureVersion.groupBy.mockResolvedValue([
      { status: 'DRAFT', _count: { _all: 2 } },
      { status: 'IN_REVIEW', _count: { _all: 1 } },
    ]);
    prisma.procedureVersion.count.mockResolvedValue(1);
    const summary = await service.summary(authUser('ADMIN'));
    expect(summary.management).toEqual({ drafts: 2, inReview: 1, reviews: 1 });
  });
});
