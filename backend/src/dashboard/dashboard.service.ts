import { Injectable } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_UPDATES = 5;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async summary(user: AuthUser) {
    const readable = this.access.procedureWhere(user);
    const [procedures, versions, openVersions] = await Promise.all([
      this.prisma.procedure.findMany({
        where: { ...readable, versions: { some: { status: 'PUBLISHED' } } },
        select: { processId: true, process: { select: { areaId: true } } },
      }),
      this.prisma.procedureVersion.findMany({
        where: { status: 'PUBLISHED', procedure: readable },
        orderBy: { publishedAt: 'desc' },
        take: RECENT_UPDATES * 4,
        select: {
          versionNumber: true,
          changeSummary: true,
          publishedAt: true,
          procedure: {
            select: { id: true, code: true, title: true, process: { select: { code: true, name: true, area: { select: { name: true } } } } },
          },
        },
      }),
      user.role === 'COLLABORATOR'
        ? Promise.resolve([])
        : this.prisma.procedureVersion.groupBy({
            by: ['status'],
            where: { status: { in: ['DRAFT', 'IN_REVIEW'] }, procedure: this.access.manageableProcedureWhere(user) },
            _count: { _all: true },
          }),
    ]);

    // Se muestra una sola vez cada procedimiento con su versión publicada más reciente
    const seen = new Set<number>();
    const recentUpdates = versions
      .filter((version) => !seen.has(version.procedure.id) && seen.add(version.procedure.id))
      .slice(0, RECENT_UPDATES);

    const count = (status: string) => openVersions.find((group) => group.status === status)?._count._all ?? 0;
    return {
      stats: {
        procedures: procedures.length,
        processes: new Set(procedures.map((procedure) => procedure.processId)).size,
        areas: new Set(procedures.map((procedure) => procedure.process.areaId)).size,
      },
      recentUpdates,
      management: user.role === 'COLLABORATOR' ? null : { drafts: count('DRAFT'), inReview: count('IN_REVIEW') },
    };
  }
}
