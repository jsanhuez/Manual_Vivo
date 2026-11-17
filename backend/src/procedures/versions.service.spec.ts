import { ConflictException, NotFoundException } from '@nestjs/common';
import { authUser, prismaMock } from '../../test/helpers';
import { VersionsService } from './versions.service';

describe('VersionsService', () => {
  const editor = authUser('EDITOR');
  const admin = authUser('ADMIN', { id: 'u-admin' });
  const procedure = { id: 4, code: 'OPE-P02-01', title: 'Programar un retiro', status: 'ACTIVE' };
  const inReview = {
    id: 9,
    versionNumber: 3,
    status: 'IN_REVIEW',
    content: 'Contenido',
    changeSummary: 'Se agrega un paso',
    createdAt: new Date(),
    author: { firstName: 'Diego', lastName: 'Muñoz', email: 'diego.munoz@empresa.test' },
    procedure: { id: 4, code: 'OPE-P02-01', title: 'Programar un retiro', accessLevel: { name: 'General' }, process: { id: 1, code: 'OPE-P02', name: 'Retiros', area: { id: 1, name: 'Operaciones' } } },
  };
  let prisma: ReturnType<typeof prismaMock>;
  let audit: { log: jest.Mock };
  let notifications: { audience: jest.Mock; versionPublished: jest.Mock; reviewRequested: jest.Mock };
  let mail: { sendVersionRejected: jest.Mock };
  let service: VersionsService;

  beforeEach(() => {
    prisma = prismaMock();
    audit = { log: jest.fn() };
    notifications = {
      audience: jest.fn().mockResolvedValue({ users: 2, routes: 1 }),
      versionPublished: jest.fn().mockResolvedValue(2),
      reviewRequested: jest.fn(),
    };
    mail = { sendVersionRejected: jest.fn().mockResolvedValue(true) };
    const procedures = { loadForManage: jest.fn().mockResolvedValue(procedure) };
    service = new VersionsService(prisma, procedures as never, audit as never, notifications as never, mail as never);
  });

  it('crea la versión siguiente cuando no hay un borrador abierto (RF-08, CP-10)', async () => {
    prisma.procedureVersion.findFirst.mockResolvedValue(null);
    prisma.procedureVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 2 } });
    prisma.procedureVersion.create.mockResolvedValue({ id: 10, versionNumber: 3 });
    await service.saveDraft(editor, 4, { content: 'Nuevo', changeSummary: 'Cambio de prueba' }, null);
    expect(prisma.procedureVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ versionNumber: 3, authorId: editor.id }) }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE' }), prisma);
  });

  it('actualiza el borrador abierto en lugar de crear otra versión (CU-11 4b)', async () => {
    prisma.procedureVersion.findFirst.mockResolvedValue({ id: 10, status: 'DRAFT', versionNumber: 3 });
    prisma.procedureVersion.update.mockResolvedValue({ id: 10, versionNumber: 3 });
    await service.saveDraft(editor, 4, { content: 'Nuevo', changeSummary: 'Cambio de prueba' }, null);
    expect(prisma.procedureVersion.update).toHaveBeenCalled();
    expect(prisma.procedureVersion.create).not.toHaveBeenCalled();
  });

  it('impide editar mientras hay una versión en revisión', async () => {
    prisma.procedureVersion.findFirst.mockResolvedValue({ id: 10, status: 'IN_REVIEW', versionNumber: 3 });
    await expect(service.saveDraft(editor, 4, { content: 'x', changeSummary: 'Cambio de prueba' }, null)).rejects.toBeInstanceOf(ConflictException);
  });

  it('envía un borrador a revisión y avisa a los administradores (RF-09)', async () => {
    prisma.procedureVersion.findUnique.mockResolvedValue({ id: 10, procedureId: 4, status: 'DRAFT' });
    prisma.procedureVersion.update.mockResolvedValue({ id: 10, versionNumber: 3, changeSummary: 'Cambio' });
    await service.submit(editor, 10, null);
    expect(prisma.procedureVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'IN_REVIEW' } }));
    expect(notifications.reviewRequested).toHaveBeenCalledWith(expect.objectContaining({ code: 'OPE-P02-01', versionNumber: 3 }));
  });

  it('solo envía a revisión versiones en borrador', async () => {
    prisma.procedureVersion.findUnique.mockResolvedValue({ id: 10, procedureId: 4, status: 'PUBLISHED' });
    await expect(service.submit(editor, 10, null)).rejects.toBeInstanceOf(ConflictException);
  });

  it('lista las versiones en revisión con la fecha de envío registrada en auditoría', async () => {
    const createdAt = new Date('2026-11-20T10:00:00Z');
    const submittedAt = new Date('2026-11-21T10:00:00Z');
    prisma.procedureVersion.findMany.mockResolvedValue([{ id: 9, createdAt }, { id: 11, createdAt }]);
    prisma.auditLog.findMany.mockResolvedValue([{ entityId: '9', createdAt: submittedAt }]);
    const list = await service.listInReview();
    expect(list.map((item) => item.submittedAt)).toEqual([submittedAt, createdAt]);
  });

  it('muestra el impacto de publicar una versión (CU-16 paso 2)', async () => {
    prisma.procedureVersion.findUnique.mockResolvedValue(inReview);
    prisma.procedureVersion.findFirst.mockResolvedValue({ versionNumber: 2, content: 'Vigente', publishedAt: new Date() });
    const detail = await service.reviewDetail(9);
    expect(detail.impact).toEqual({ users: 2, routes: 1 });
    expect(detail.author).toEqual({ firstName: 'Diego', lastName: 'Muñoz' });
  });

  it('publica la versión, registra al revisor y avisa a quienes deben reconfirmar (RF-09, RF-16)', async () => {
    prisma.procedureVersion.findUnique.mockResolvedValue(inReview);
    prisma.procedureVersion.update.mockResolvedValue({ id: 9, status: 'PUBLISHED' });
    const result = await service.publish(admin, 9, null);
    const update = prisma.procedureVersion.update.mock.calls[0][0];
    expect(update.data).toMatchObject({ status: 'PUBLISHED', reviewerId: admin.id });
    expect(update.data.publishedAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PUBLISH', details: expect.objectContaining({ affected: 2 }) }), prisma);
    expect(result.notified).toBe(2);
  });

  it('rechaza con observación y avisa al autor (CP-11)', async () => {
    prisma.procedureVersion.findUnique.mockResolvedValue(inReview);
    prisma.procedureVersion.update.mockResolvedValue({ id: 9, status: 'REJECTED' });
    await service.reject(admin, 9, { reviewNotes: 'Falta el plazo de aviso' }, null);
    expect(prisma.procedureVersion.update.mock.calls[0][0].data).toMatchObject({ status: 'REJECTED', reviewNotes: 'Falta el plazo de aviso' });
    expect(mail.sendVersionRejected).toHaveBeenCalledWith(inReview.author, expect.objectContaining({ reviewNotes: 'Falta el plazo de aviso' }));
  });

  it('no publica una versión que ya no está en revisión', async () => {
    prisma.procedureVersion.findUnique.mockResolvedValue({ ...inReview, status: 'PUBLISHED' });
    await expect(service.publish(admin, 9, null)).rejects.toBeInstanceOf(ConflictException);
    prisma.procedureVersion.findUnique.mockResolvedValue(null);
    await expect(service.publish(admin, 9, null)).rejects.toBeInstanceOf(NotFoundException);
  });
});
