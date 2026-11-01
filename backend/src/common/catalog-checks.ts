import { UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function accessLevelValue(prisma: PrismaService, accessLevelId: number): Promise<number> {
  const level = await prisma.accessLevel.findUnique({ where: { id: accessLevelId } });
  if (!level) {
    throw new UnprocessableEntityException('El nivel de acceso no existe');
  }
  return level.level;
}

export async function assertActiveArea(prisma: PrismaService, areaId: number): Promise<void> {
  const area = await prisma.area.findUnique({ where: { id: areaId } });
  if (!area?.isActive) {
    throw new UnprocessableEntityException('El área seleccionada no existe o está inactiva');
  }
}

export function latestDate(dates: (Date | null | undefined)[]): Date | null {
  const times = dates.filter((date): date is Date => !!date).map((date) => date.getTime());
  return times.length ? new Date(Math.max(...times)) : null;
}
