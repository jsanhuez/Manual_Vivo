import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccessService } from '../access/access.service';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';

export interface RouteProgressRow {
  routeId: number;
  routeName: string;
  userId: string;
  firstName: string;
  lastName: string;
  areaName: string;
  assignedAt: Date;
  dueDate: Date | null;
  required: number;
  completed: number;
  pct: number | null;
}

export interface CoverageRow {
  procedureId: number;
  code: string;
  title: string;
  versionNumber: number;
  publishedAt: Date;
  audience: number;
  confirmed: number;
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  // El editor ve el avance de las personas de su área y el administrador el de todos
  routes(user: AuthUser): Promise<RouteProgressRow[]> {
    const scope = user.role === 'ADMIN' ? Prisma.empty : Prisma.sql`AND u.area_id = ${user.areaId}`;
    return this.prisma.$queryRaw<RouteProgressRow[]>`
      SELECT rp.route_id AS "routeId", r.name AS "routeName", u.id AS "userId",
             u.first_name AS "firstName", u.last_name AS "lastName", a.name AS "areaName",
             ra.assigned_at AS "assignedAt", rp.due_date AS "dueDate",
             rp.required_steps::int AS required, rp.completed_steps::int AS completed, rp.progress_pct::float8 AS pct
      FROM v_route_progress rp
      JOIN route_assignments ra ON ra.route_id = rp.route_id AND ra.user_id = rp.user_id
      JOIN onboarding_routes r  ON r.id = rp.route_id
      JOIN users u              ON u.id = rp.user_id
      JOIN areas a              ON a.id = u.area_id
      WHERE u.is_active AND r.is_active ${scope}
      ORDER BY rp.progress_pct ASC NULLS FIRST, u.first_name, r.name`;
  }

  // Cobertura de la versión vigente entre quienes leyeron una versión anterior o la tienen en su ruta
  async coverage(user: AuthUser): Promise<CoverageRow[]> {
    let scope = Prisma.empty;
    if (user.role !== 'ADMIN') {
      const ids = (await this.prisma.procedure.findMany({ where: this.access.manageableProcedureWhere(user), select: { id: true } })).map((item) => item.id);
      if (!ids.length) {
        return [];
      }
      scope = Prisma.sql`AND p.id IN (${Prisma.join(ids)})`;
    }
    return this.prisma.$queryRaw<CoverageRow[]>`
      WITH audience AS (
        SELECT a.user_id, a.procedure_id
        FROM v_procedure_access a
        WHERE EXISTS (SELECT 1 FROM read_confirmations rc
                      JOIN procedure_versions pv ON pv.id = rc.version_id
                      WHERE rc.user_id = a.user_id AND pv.procedure_id = a.procedure_id)
           OR EXISTS (SELECT 1 FROM route_assignments ra
                      JOIN route_steps rs ON rs.route_id = ra.route_id
                      WHERE ra.user_id = a.user_id AND rs.procedure_id = a.procedure_id)
      )
      SELECT p.id AS "procedureId", p.code, p.title, cv.version_number::int AS "versionNumber", cv.published_at AS "publishedAt",
             count(au.user_id)::int AS audience, count(rc.user_id)::int AS confirmed
      FROM v_current_versions cv
      JOIN procedures p      ON p.id = cv.procedure_id
      JOIN audience au       ON au.procedure_id = p.id
      LEFT JOIN read_confirmations rc ON rc.user_id = au.user_id AND rc.version_id = cv.version_id
      WHERE p.status = 'ACTIVE' ${scope}
      GROUP BY p.id, p.code, p.title, cv.version_number, cv.published_at
      ORDER BY count(rc.user_id)::float8 / count(au.user_id), p.code`;
  }
}
