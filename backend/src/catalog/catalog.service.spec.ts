import { ConflictException } from '@nestjs/common';
import { authUser, prismaMock } from '../../test/helpers';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const admin = authUser('ADMIN');
  let prisma: ReturnType<typeof prismaMock>;
  let service: CatalogService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new CatalogService(prisma, { log: jest.fn() } as never);
  });

  it('impide desactivar un área con usuarios activos (CP-07)', async () => {
    prisma.area.findUnique.mockResolvedValue({ id: 1, isActive: true });
    prisma.user.count.mockResolvedValue(3);
    await expect(service.updateArea(1, { name: 'Operaciones', isActive: false }, admin, null)).rejects.toThrow('3 usuarios activos');
  });

  it('impide eliminar un nivel de acceso en uso', async () => {
    prisma.accessLevel.findUnique.mockResolvedValue({ id: 1, name: 'General', _count: { users: 2, processes: 1, procedures: 0 } });
    await expect(service.deleteAccessLevel(1, admin, null)).rejects.toBeInstanceOf(ConflictException);
  });

  it('elimina un nivel de acceso sin uso y lo registra en auditoría', async () => {
    prisma.accessLevel.findUnique.mockResolvedValue({ id: 4, name: 'Temporal', _count: { users: 0, processes: 0, procedures: 0 } });
    await service.deleteAccessLevel(4, admin, null);
    expect(prisma.accessLevel.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it('informa usuarios y procesos activos por área', async () => {
    prisma.area.findMany.mockResolvedValue([{ id: 1, name: 'Operaciones', _count: { users: 2, processes: 1 } }]);
    await expect(service.listAreas()).resolves.toEqual([{ id: 1, name: 'Operaciones', activeUsers: 2, activeProcesses: 1 }]);
  });
});
