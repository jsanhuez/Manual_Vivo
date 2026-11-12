import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/auth-user';

const NOTHING = { id: { in: [] as number[] } };

@Injectable()
export class AccessService {
  // Replica la regla de la vista v_procedure_access: área propia, transversal o habilitada y nivel suficiente
  processWhere(user: AuthUser): Prisma.ProcessWhereInput {
    if (user.role === 'ADMIN') {
      return { status: 'ACTIVE' };
    }
    return {
      status: 'ACTIVE',
      accessLevel: { level: { lte: user.level } },
      OR: [{ areaId: user.areaId }, { isCrossArea: true }, { visibility: { some: { areaId: user.areaId } } }],
    };
  }

  procedureLevelWhere(user: AuthUser): Prisma.ProcedureWhereInput {
    if (user.role === 'ADMIN') {
      return { status: 'ACTIVE' };
    }
    return { status: 'ACTIVE', accessLevel: { level: { lte: user.level } } };
  }

  procedureWhere(user: AuthUser): Prisma.ProcedureWhereInput {
    return { ...this.procedureLevelWhere(user), process: this.processWhere(user) };
  }

  // Un editor gestiona contenido de su área y solo con niveles que él mismo puede consultar
  canManage(user: AuthUser, areaId: number, levels: number[]): boolean {
    if (user.role === 'ADMIN') {
      return true;
    }
    return user.role === 'EDITOR' && user.areaId === areaId && levels.every((level) => level <= user.level);
  }

  manageableProcessWhere(user: AuthUser): Prisma.ProcessWhereInput {
    if (user.role === 'ADMIN') {
      return {};
    }
    if (user.role !== 'EDITOR') {
      return NOTHING;
    }
    return { areaId: user.areaId, accessLevel: { level: { lte: user.level } } };
  }

  manageableProcedureWhere(user: AuthUser): Prisma.ProcedureWhereInput {
    if (user.role === 'ADMIN') {
      return {};
    }
    if (user.role !== 'EDITOR') {
      return NOTHING;
    }
    return { accessLevel: { level: { lte: user.level } }, process: this.manageableProcessWhere(user) };
  }

  // Las rutas transversales (sin área) solo las gestiona el administrador
  manageableRouteWhere(user: AuthUser): Prisma.OnboardingRouteWhereInput {
    if (user.role === 'ADMIN') {
      return {};
    }
    return user.role === 'EDITOR' ? { areaId: user.areaId } : NOTHING;
  }

  canManageRoute(user: AuthUser, areaId: number | null): boolean {
    return user.role === 'ADMIN' || (user.role === 'EDITOR' && areaId === user.areaId);
  }
}
