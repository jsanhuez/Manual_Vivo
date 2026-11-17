import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { authUser, prismaMock } from '../../test/helpers';
import { ProceduresService } from './procedures.service';

describe('ProceduresService', () => {
  const collaborator = authUser('COLLABORATOR', { areaId: 1, level: 1 });
  const editor = authUser('EDITOR', { areaId: 1, level: 2 });
  const version = (id: number, versionNumber: number, status: string) => ({
    id,
    versionNumber,
    status,
    changeSummary: `Cambio ${versionNumber}`,
    reviewNotes: null,
    createdAt: new Date(),
    publishedAt: status === 'PUBLISHED' ? new Date() : null,
    author: { firstName: 'Diego', lastName: 'Muñoz' },
  });
  const procedure = {
    id: 4,
    code: 'OPE-P02-01',
    title: 'Programar un retiro',
    sortOrder: 1,
    accessLevel: { id: 1, name: 'General', level: 1 },
    process: { id: 1, code: 'OPE-P02', name: 'Retiros', areaId: 1, accessLevel: { level: 1 }, area: { id: 1, name: 'Operaciones' }, owner: { firstName: 'Diego', lastName: 'Muñoz' } },
    versions: [version(12, 3, 'DRAFT'), version(11, 2, 'PUBLISHED'), version(10, 1, 'PUBLISHED')],
  };
  let prisma: ReturnType<typeof prismaMock>;
  let audit: { log: jest.Mock };
  let service: ProceduresService;

  beforeEach(() => {
    prisma = prismaMock();
    audit = { log: jest.fn() };
    const processes = { relationsFor: jest.fn().mockResolvedValue({ outgoing: [], incoming: [] }) };
    service = new ProceduresService(prisma, new AccessService(), audit as never, processes as never);
    prisma.procedure.findFirst.mockResolvedValue(procedure);
  });

  it('responde 403 y audita el acceso directo a contenido no autorizado (CP-13)', async () => {
    prisma.procedure.count.mockResolvedValue(0);
    await expect(service.getVisible(collaborator, 4, '10.0.0.1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ACCESS_DENIED', entity: 'procedures', ip: '10.0.0.1' }));
  });

  it('muestra la versión vigente, el historial y si la lectura está al día (RF-08 y RF-15)', async () => {
    prisma.procedure.count.mockResolvedValue(1);
    prisma.procedureVersion.findUniqueOrThrow.mockResolvedValue({ content: '## Vigente' });
    prisma.readConfirmation.findFirst.mockResolvedValue({ confirmedAt: new Date(), version: { id: 10, versionNumber: 1 } });
    const detail = await service.getVisible(collaborator, 4, null);
    expect(detail.currentVersion).toMatchObject({ versionNumber: 2, content: '## Vigente' });
    expect(detail.history.map((item) => item.versionNumber)).toEqual([2, 1]);
    expect(detail.reading).toMatchObject({ lastReadVersion: 1, currentConfirmed: false });
    expect(detail.workflow).toEqual([]);
  });

  it('muestra los borradores solo a quien gestiona el procedimiento', async () => {
    prisma.procedure.count.mockResolvedValue(1);
    prisma.procedureVersion.findUniqueOrThrow.mockResolvedValue({ content: '## Vigente' });
    prisma.readConfirmation.findFirst.mockResolvedValue(null);
    const detail = await service.getVisible(editor, 4, null);
    expect(detail.canManage).toBe(true);
    expect(detail.workflow.map((item) => item.status)).toEqual(['DRAFT']);
  });

  it('no entrega un borrador a quien no gestiona el procedimiento', async () => {
    prisma.procedure.count.mockResolvedValue(1);
    prisma.procedureVersion.findUnique.mockResolvedValue(version(12, 3, 'DRAFT'));
    await expect(service.getVersion(collaborator, 4, 3, null)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('impide crear procedimientos en procesos de otra área', async () => {
    prisma.process.findUnique.mockResolvedValue({ id: 2, areaId: 2, status: 'ACTIVE', accessLevel: { level: 1 } });
    prisma.accessLevel.findUnique.mockResolvedValue({ level: 1 });
    const dto = { processId: 2, code: 'COM-P01-02', title: 'Nuevo', sortOrder: 2, accessLevelId: 1, content: 'Contenido', changeSummary: 'Versión inicial' };
    await expect(service.create(editor, dto, null)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('crea el procedimiento con su versión 1 en borrador (RF-07)', async () => {
    prisma.process.findUnique.mockResolvedValue({ id: 1, areaId: 1, status: 'ACTIVE', accessLevel: { level: 1 } });
    prisma.accessLevel.findUnique.mockResolvedValue({ level: 1 });
    prisma.procedure.create.mockResolvedValue({ id: 6, code: 'OPE-P02-03', title: 'Nuevo', versions: [{ id: 20, versionNumber: 1, status: 'DRAFT' }] });
    const dto = { processId: 1, code: 'OPE-P02-03', title: 'Nuevo', sortOrder: 3, accessLevelId: 1, content: 'Contenido', changeSummary: 'Versión inicial' };
    const created = await service.create(editor, dto, null);
    expect(created.openVersion).toEqual({ id: 20, versionNumber: 1, status: 'DRAFT' });
    expect(prisma.procedure.create.mock.calls[0][0].data.versions.create).toMatchObject({ versionNumber: 1, authorId: editor.id });
  });
});
