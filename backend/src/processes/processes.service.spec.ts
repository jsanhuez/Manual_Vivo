import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { authUser, prismaMock } from '../../test/helpers';
import { ProcessesService } from './processes.service';

describe('ProcessesService', () => {
  const editor = authUser('EDITOR', { areaId: 1, level: 2 });
  const dto = {
    code: 'OPE-P02',
    name: 'Coordinación de retiros',
    objective: 'Programar retiros',
    scope: null,
    areaId: 1,
    ownerId: '00000000-0000-4000-8000-000000000001',
    accessLevelId: 1,
    isCrossArea: false,
    visibleAreaIds: [2],
  };
  let prisma: ReturnType<typeof prismaMock>;
  let audit: { log: jest.Mock };
  let service: ProcessesService;

  beforeEach(() => {
    prisma = prismaMock();
    audit = { log: jest.fn() };
    service = new ProcessesService(prisma, new AccessService(), audit as never);
    prisma.process.findUnique.mockResolvedValue({ id: 4, areaId: 1, accessLevel: { level: 1 } });
    prisma.accessLevel.findUnique.mockResolvedValue({ level: 1 });
    prisma.user.findUnique.mockResolvedValue({ isActive: true, areaId: 1, role: { name: 'EDITOR' } });
  });

  it('rechaza relacionar un proceso consigo mismo (CP-16)', async () => {
    const relations = [{ targetProcessId: 4, relationType: 'TRIGGERS' as const }];
    await expect(service.update(editor, 4, { ...dto, relations }, null)).rejects.toThrow('consigo mismo');
  });

  it('rechaza relaciones repetidas del mismo tipo', async () => {
    const relations = [
      { targetProcessId: 2, relationType: 'TRIGGERS' as const },
      { targetProcessId: 2, relationType: 'TRIGGERS' as const },
    ];
    await expect(service.update(editor, 4, { ...dto, relations }, null)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rechaza relaciones con procesos que el editor no puede consultar', async () => {
    prisma.process.count.mockResolvedValue(0);
    const relations = [{ targetProcessId: 9, relationType: 'DEPENDS_ON' as const }];
    await expect(service.update(editor, 4, { ...dto, relations }, null)).rejects.toThrow('no existe o no está disponible');
  });

  it('reemplaza solo las relaciones hacia procesos visibles y guarda la auditoría (RF-12)', async () => {
    prisma.process.count.mockResolvedValue(1);
    prisma.process.update.mockResolvedValue({ id: 4, code: 'OPE-P02', name: dto.name });
    const relations = [{ targetProcessId: 1, relationType: 'INFORMATION_HANDOFF' as const, description: 'Retiros del mes' }];
    await service.update(editor, 4, { ...dto, relations }, null);
    expect(prisma.processRelation.deleteMany).toHaveBeenCalledWith({ where: { sourceProcessId: 4, target: new AccessService().processWhere(editor) } });
    expect(prisma.processRelation.createMany).toHaveBeenCalledWith({
      data: [{ sourceProcessId: 4, targetProcessId: 1, relationType: 'INFORMATION_HANDOFF', description: 'Retiros del mes' }],
    });
    expect(prisma.processVisibility.createMany).toHaveBeenCalledWith({ data: [{ processId: 4, areaId: 2 }] });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE' }), prisma);
  });

  it('impide que un editor modifique procesos de otra área (CP-08)', async () => {
    prisma.process.findUnique.mockResolvedValue({ id: 4, areaId: 3, accessLevel: { level: 1 } });
    await expect(service.update(editor, 4, dto, null)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('arma el mapa con los procesos visibles y sus relaciones', async () => {
    prisma.process.findMany.mockResolvedValue([
      { id: 1, code: 'COM-P01', name: 'Traspaso', area: { id: 2, name: 'Comercial' }, isCrossArea: false, procedures: [{ id: 3 }] },
      { id: 4, code: 'OPE-P02', name: 'Retiros', area: { id: 1, name: 'Operaciones' }, isCrossArea: false, procedures: [] },
    ]);
    prisma.processRelation.findMany.mockResolvedValue([{ id: 1, sourceProcessId: 1, targetProcessId: 4, relationType: 'INFORMATION_HANDOFF', description: null }]);
    const map = await service.map(editor);
    expect(map.nodes.map((node) => node.procedureCount)).toEqual([1, 0]);
    expect(prisma.processRelation.findMany.mock.calls[0][0].where).toEqual({ sourceProcessId: { in: [1, 4] }, targetProcessId: { in: [1, 4] } });
  });
});
