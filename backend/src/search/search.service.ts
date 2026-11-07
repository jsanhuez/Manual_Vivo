import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto } from './search-query.dto';

export interface SearchResult {
  id: number;
  code: string;
  title: string;
  processId: number;
  processCode: string;
  processName: string;
  areaId: number;
  areaName: string;
  versionNumber: number;
  publishedAt: Date;
  snippet: string;
  rank: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  // Usa las vistas del modelo para buscar solo en la versión vigente de lo que el usuario puede ver (RF-10 y RF-11)
  search(user: AuthUser, query: SearchQueryDto): Promise<SearchResult[]> {
    const codePrefix = `${query.q.replace(/[\\%_]/g, '\\$&')}%`;
    const areaFilter = query.areaId ? Prisma.sql`AND pr.area_id = ${query.areaId}` : Prisma.empty;
    const processFilter = query.processId ? Prisma.sql`AND pr.id = ${query.processId}` : Prisma.empty;

    return this.prisma.$queryRaw<SearchResult[]>`
      SELECT p.id, p.code, p.title,
             pr.id AS "processId", pr.code AS "processCode", pr.name AS "processName",
             a.id AS "areaId", a.name AS "areaName",
             cv.version_number AS "versionNumber", cv.published_at AS "publishedAt",
             ts_headline('spanish', pv.content, q, 'StartSel=⟦, StopSel=⟧, MaxFragments=1, MaxWords=28, MinWords=10') AS snippet,
             (ts_rank(to_tsvector('spanish', p.title), q) * 2 + ts_rank(to_tsvector('spanish', pv.content), q))::float8 AS rank
      FROM v_procedure_access acc
      JOIN procedures p          ON p.id = acc.procedure_id
      JOIN processes pr          ON pr.id = p.process_id
      JOIN areas a               ON a.id = pr.area_id
      JOIN v_current_versions cv ON cv.procedure_id = p.id
      JOIN procedure_versions pv ON pv.id = cv.version_id
      CROSS JOIN websearch_to_tsquery('spanish', ${query.q}) q
      WHERE acc.user_id = ${user.id}::uuid
        AND (to_tsvector('spanish', pv.content) @@ q
             OR to_tsvector('spanish', p.title) @@ q
             OR p.code ILIKE ${codePrefix})
        ${areaFilter}
        ${processFilter}
      ORDER BY rank DESC, p.code
      LIMIT 50`;
  }
}
