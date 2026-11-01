import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { allowedOrigins } from '../config/env.validation';

export interface MailRecipient {
  email: string;
  firstName: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;

  constructor(config: ConfigService) {
    this.frontendUrl = allowedOrigins(config.getOrThrow<string>('FRONTEND_URL'))[0];
  }

  // El token viaja después de # para que no llegue a los registros del servidor que entrega el frontend
  sendInvitation(recipient: MailRecipient, token: string): Promise<void> {
    return this.deliver(recipient, 'Te damos la bienvenida a Manual Vivo', `${this.frontendUrl}/activar#${token}`);
  }

  sendPasswordReset(recipient: MailRecipient, token: string): Promise<void> {
    return this.deliver(recipient, 'Recupera tu contraseña de Manual Vivo', `${this.frontendUrl}/restablecer#${token}`);
  }

  // Render bloquea SMTP en el plan gratuito, así que hasta definir un proveedor HTTPS el correo queda en el log
  private async deliver(recipient: MailRecipient, subject: string, link: string): Promise<void> {
    this.logger.log(`Correo para ${recipient.email} | ${subject} | ${link}`);
  }
}
