import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { allowedOrigins } from '../config/env.validation';

export interface MailRecipient {
  email: string;
  firstName: string;
}

export interface VersionNotice {
  procedureId: number;
  code: string;
  title: string;
  versionNumber: number;
  changeSummary: string;
  reviewNotes?: string | null;
}

interface MailMessage {
  subject: string;
  lines: string[];
  action: { label: string; url: string };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;
  private readonly sender: { email: string | undefined; name: string };

  constructor(config: ConfigService) {
    this.frontendUrl = allowedOrigins(config.getOrThrow<string>('FRONTEND_URL'))[0];
    this.apiUrl = config.getOrThrow<string>('BREVO_API_URL');
    this.apiKey = config.get<string>('BREVO_API_KEY');
    this.sender = { email: config.get<string>('MAIL_FROM'), name: config.getOrThrow<string>('MAIL_FROM_NAME') };
  }

  // El token viaja después de # para que no llegue a los registros del servidor que entrega el frontend
  sendInvitation(recipient: MailRecipient, token: string, routeName?: string): Promise<boolean> {
    const lines = ['Se creó tu cuenta en Manual Vivo. Define tu contraseña con el siguiente enlace, válido por 72 horas.'];
    if (routeName) {
      lines.push(`Al ingresar encontrarás tu ruta de onboarding «${routeName}».`);
    }
    return this.deliver(recipient, {
      subject: 'Te damos la bienvenida a Manual Vivo',
      lines,
      action: { label: 'Activar mi cuenta', url: `${this.frontendUrl}/activar#${token}` },
    });
  }

  sendPasswordReset(recipient: MailRecipient, token: string): Promise<boolean> {
    return this.deliver(recipient, {
      subject: 'Recupera tu contraseña de Manual Vivo',
      lines: [
        'Recibimos una solicitud para restablecer tu contraseña. El enlace es válido por 30 minutos y sirve una sola vez.',
        'Si no la solicitaste, puedes ignorar este correo.',
      ],
      action: { label: 'Definir nueva contraseña', url: `${this.frontendUrl}/restablecer#${token}` },
    });
  }

  sendVersionPublished(recipient: MailRecipient, notice: VersionNotice): Promise<boolean> {
    return this.deliver(recipient, {
      subject: `Actualización de ${notice.code}: confirma la lectura de la versión ${notice.versionNumber}`,
      lines: [
        `Se publicó la versión ${notice.versionNumber} de «${notice.code} ${notice.title}».`,
        `Cambios: ${notice.changeSummary}`,
        'Revisa el contenido y confirma tu lectura para mantener tu información al día.',
      ],
      action: { label: 'Leer la versión vigente', url: `${this.frontendUrl}/procedimientos/${notice.procedureId}` },
    });
  }

  sendReviewRequested(recipient: MailRecipient, notice: VersionNotice): Promise<boolean> {
    return this.deliver(recipient, {
      subject: `Versión en revisión: ${notice.code} v${notice.versionNumber}`,
      lines: [`La versión ${notice.versionNumber} de «${notice.code} ${notice.title}» espera tu revisión.`, `Cambios: ${notice.changeSummary}`],
      action: { label: 'Ir a revisiones pendientes', url: `${this.frontendUrl}/admin/revisiones` },
    });
  }

  sendVersionRejected(recipient: MailRecipient, notice: VersionNotice): Promise<boolean> {
    return this.deliver(recipient, {
      subject: `Versión rechazada: ${notice.code} v${notice.versionNumber}`,
      lines: [
        `La versión ${notice.versionNumber} de «${notice.code} ${notice.title}» fue rechazada.`,
        `Observación: ${notice.reviewNotes ?? ''}`,
        'Corrige el contenido y vuelve a enviarlo a revisión.',
      ],
      action: { label: 'Abrir el editor', url: `${this.frontendUrl}/gestion/procedimientos/${notice.procedureId}` },
    });
  }

  sendRouteAssigned(recipient: MailRecipient, routeName: string, dueDate: string | null): Promise<boolean> {
    const due = dueDate ? ` con fecha límite ${dueDate.split('-').reverse().join('-')}` : '';
    return this.deliver(recipient, {
      subject: `Se te asignó la ruta de onboarding «${routeName}»`,
      lines: [`Tienes una nueva ruta de onboarding${due}.`, 'Lee cada paso y confirma tu lectura para registrar tu avance.'],
      action: { label: 'Ver mi onboarding', url: `${this.frontendUrl}/onboarding` },
    });
  }

  // Render gratuito bloquea SMTP, por eso se usa la API HTTPS de Brevo
  private async deliver(recipient: MailRecipient, message: MailMessage): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.log(`Correo para ${recipient.email} | ${message.subject} | ${message.action.url}`);
      return true;
    }
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: this.sender,
          to: [{ email: recipient.email, name: recipient.firstName }],
          subject: message.subject,
          htmlContent: this.html(recipient, message),
          textContent: [`Hola ${recipient.firstName}:`, ...message.lines, `${message.action.label}: ${message.action.url}`].join('\n\n'),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.error(`Brevo respondió ${response.status} al enviar a ${recipient.email}: ${await response.text()}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo a ${recipient.email}: ${(error as Error).message}`);
      return false;
    }
  }

  private html(recipient: MailRecipient, message: MailMessage): string {
    const paragraphs = message.lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join('');
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#18212f;max-width:560px">
<p style="margin:0 0 12px">Hola ${escapeHtml(recipient.firstName)}:</p>${paragraphs}
<p style="margin:20px 0"><a href="${escapeHtml(message.action.url)}" style="background:#1d5fa8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(message.action.label)}</a></p>
<p style="margin:0;color:#566475;font-size:12px">Manual Vivo · Mensaje automático, no respondas este correo.</p></div>`;
  }
}
