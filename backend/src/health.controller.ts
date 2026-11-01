import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from './common/decorators';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Responde 200 aunque la base no esté disponible para que Render no reinicie la API por una pausa de Supabase
  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    const database = await this.prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down');
    return { status: 'ok', database, time: new Date().toISOString() };
  }
}
