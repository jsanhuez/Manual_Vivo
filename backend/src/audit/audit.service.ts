import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './audit-query.dto';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | number | null;
  details?: Prisma.InputJsonValue;
  ip?: string | null;
}

const PAGE_SIZE = 20;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Recibe la transacción en curso para que el cambio y su registro ocurran juntos o no ocurran
  async log(entry: AuditEntry, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId == null ? null : String(entry.entityId),
        details: entry.details,
        ipAddress: entry.ip ?? null,
      },
    });
  }

  async list(query: AuditQueryDto) {
    const page = query.page ?? 1;
    const where: Prisma.AuditLogWhereInput = {
      userId: query.userId,
      action: query.action,
      createdAt: { gte: query.from ? new Date(query.from) : undefined, lt: query.to ? new Date(query.to) : undefined },
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          details: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    // El id es BIGINT y JSON no serializa BigInt
    return { items: items.map((item) => ({ ...item, id: item.id.toString() })), total, page, pageSize: PAGE_SIZE };
  }
}
