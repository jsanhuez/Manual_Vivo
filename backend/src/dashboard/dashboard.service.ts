import { Injectable } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

const RECENT_UPDATES = 5;

interface PendingRead {
  procedureId: number;
  code: string;
  title: string;
  versionNumber: number;
  changeSummary: string;
  publishedAt: Date;
  changed: boolean;
}

interface RouteSummary {
  routeId: number;
  name: string;
  dueDate: Date | null;
  required: number;
  completed: number;
  pct: number | null;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async summary(user: AuthUser) {
    const readable = this.access.procedureWhere(user);
    const [procedures, versions, openVersions, pendingReads, onboarding, reviews] = await Promise.all([
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
      // changed distingue un procedimiento actualizado de uno de la ruta que aún no se lee
      this.prisma.$queryRaw<PendingRead[]>`
        SELECT p.procedure_id AS "procedureId", pr.code, pr.title, p.version_number::int AS "versionNumber",
               pv.change_summary AS "changeSummary", pv.published_at AS "publishedAt",
               EXISTS (SELECT 1 FROM read_confirmations rc
                       JOIN procedure_versions o ON o.id = rc.version_id
                       WHERE rc.user_id = p.user_id AND o.procedure_id = p.procedure_id) AS changed
        FROM v_pending_reconfirmations p
        JOIN procedures pr         ON pr.id = p.procedure_id
        JOIN procedure_versions pv ON pv.id = p.current_version_id
        WHERE p.user_id = ${user.id}::uuid
        ORDER BY changed DESC, pv.published_at DESC
        LIMIT 10`,
      this.prisma.$queryRaw<RouteSummary[]>`
        SELECT rp.route_id AS "routeId", r.name, rp.due_date AS "dueDate",
               rp.required_steps::int AS required, rp.completed_steps::int AS completed, rp.progress_pct::float8 AS pct
        FROM v_route_progress rp
        JOIN onboarding_routes r ON r.id = rp.route_id
        WHERE rp.user_id = ${user.id}::uuid AND r.is_active
        ORDER BY r.name`,
      user.role === 'ADMIN' ? this.prisma.procedureVersion.count({ where: { status: 'IN_REVIEW' } }) : Promise.resolve(null),
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
      pendingReads,
      onboarding,
      management: user.role === 'COLLABORATOR' ? null : { drafts: count('DRAFT'), inReview: count('IN_REVIEW'), reviews },
    };
  }
}
