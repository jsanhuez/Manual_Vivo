import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { allowedOrigins } from './config/env.validation';

// Se comparte entre main.ts y las pruebas e2e para que ambos usen la misma configuración
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  // Render entrega la IP real del cliente en X-Forwarded-For
  app.set('trust proxy', 1);
  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: allowedOrigins(config.getOrThrow<string>('FRONTEND_URL')),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
