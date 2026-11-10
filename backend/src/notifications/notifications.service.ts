import { Injectable } from '@nestjs/common';
import { MailRecipient, MailService, VersionNotice } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // Personas con acceso que leyeron una versión anterior o tienen el procedimiento en su ruta
  async audience(procedureId: number): Promise<{ users: number; routes: number }> {
    const [row] = await this.prisma.$queryRaw<{ users: number; routes: number }[]>`
      SELECT (SELECT count(*)::int
                FROM v_procedure_access a
               WHERE a.procedure_id = ${procedureId}
                 AND (EXISTS (SELECT 1 FROM read_confirmations rc
                              JOIN procedure_versions pv ON pv.id = rc.version_id
                              WHERE rc.user_id = a.user_id AND pv.procedure_id = a.procedure_id)
                   OR EXISTS (SELECT 1 FROM route_assignments ra
                              JOIN route_steps rs ON rs.route_id = ra.route_id
                              WHERE ra.user_id = a.user_id AND rs.procedure_id = a.procedure_id))) AS users,
             (SELECT count(DISTINCT rs.route_id)::int
                FROM route_steps rs
                JOIN onboarding_routes r ON r.id = rs.route_id
               WHERE rs.procedure_id = ${procedureId} AND r.is_active) AS routes`;
    return row;
  }

  async versionPublished(notice: VersionNotice): Promise<number> {
    const recipients = await this.prisma.$queryRaw<MailRecipient[]>`
      SELECT u.email, u.first_name AS "firstName"
      FROM v_pending_reconfirmations p
      JOIN users u ON u.id = p.user_id
      WHERE p.procedure_id = ${notice.procedureId}`;
    await Promise.allSettled(recipients.map((recipient) => this.mail.sendVersionPublished(recipient, notice)));
    return recipients.length;
  }

  async reviewRequested(notice: VersionNotice): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { isActive: true, passwordHash: { not: null }, role: { name: 'ADMIN' } },
      select: { email: true, firstName: true },
    });
    await Promise.allSettled(admins.map((admin) => this.mail.sendReviewRequested(admin, notice)));
  }
}
