import { authUser } from '../../test/helpers';
import { AccessService } from './access.service';

describe('AccessService', () => {
  const access = new AccessService();
  const admin = authUser('ADMIN');
  const editor = authUser('EDITOR', { areaId: 1, level: 2 });
  const collaborator = authUser('COLLABORATOR', { areaId: 1, level: 1 });

  it('el administrador consulta todo el contenido activo', () => {
    expect(access.processWhere(admin)).toEqual({ status: 'ACTIVE' });
    expect(access.procedureLevelWhere(admin)).toEqual({ status: 'ACTIVE' });
  });

  it('el colaborador ve su área, lo transversal y lo habilitado, hasta su nivel (RF-10)', () => {
    expect(access.processWhere(collaborator)).toEqual({
      status: 'ACTIVE',
      accessLevel: { level: { lte: 1 } },
      OR: [{ areaId: 1 }, { isCrossArea: true }, { visibility: { some: { areaId: 1 } } }],
    });
    expect(access.procedureWhere(collaborator)).toMatchObject({ accessLevel: { level: { lte: 1 } }, process: { status: 'ACTIVE' } });
  });

  it('el editor gestiona solo su área y niveles que puede consultar (CP-08)', () => {
    expect(access.canManage(editor, 1, [1, 2])).toBe(true);
    expect(access.canManage(editor, 2, [1])).toBe(false);
    expect(access.canManage(editor, 1, [3])).toBe(false);
    expect(access.canManage(collaborator, 1, [1])).toBe(false);
    expect(access.canManage(admin, 3, [3])).toBe(true);
  });

  it('limita los listados de gestión según el rol', () => {
    expect(access.manageableProcessWhere(admin)).toEqual({});
    expect(access.manageableProcessWhere(editor)).toEqual({ areaId: 1, accessLevel: { level: { lte: 2 } } });
    expect(access.manageableProcessWhere(collaborator)).toEqual({ id: { in: [] } });
    expect(access.manageableProcedureWhere(admin)).toEqual({});
    expect(access.manageableProcedureWhere(collaborator)).toEqual({ id: { in: [] } });
    expect(access.manageableProcedureWhere(editor)).toMatchObject({ process: { areaId: 1 } });
  });

  it('solo el administrador gestiona rutas transversales (RF-13)', () => {
    expect(access.manageableRouteWhere(admin)).toEqual({});
    expect(access.manageableRouteWhere(editor)).toEqual({ areaId: 1 });
    expect(access.manageableRouteWhere(collaborator)).toEqual({ id: { in: [] } });
    expect(access.canManageRoute(admin, null)).toBe(true);
    expect(access.canManageRoute(editor, null)).toBe(false);
    expect(access.canManageRoute(editor, 1)).toBe(true);
    expect(access.canManageRoute(collaborator, 1)).toBe(false);
  });
});
