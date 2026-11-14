import type { PersonRef, Progress, RoleName, StepStatus, VersionStatus } from '@/api/types';

const dateFormat = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
// Las fechas sin hora llegan a medianoche UTC y en Chile se verían como el día anterior
const dateOnlyFormat = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(value?: string | null): string {
  return value ? dateFormat.format(new Date(value)) : '—';
}

export function formatDateTime(value?: string | null): string {
  return value ? dateTimeFormat.format(new Date(value)) : '—';
}

export function formatDateOnly(value?: string | null): string {
  return value ? dateOnlyFormat.format(new Date(value)) : '—';
}

export function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : '';
}

// Se arma con la hora local porque toISOString usa UTC y de noche en Chile ya sería el día siguiente
export function todayInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function fullName(person?: PersonRef | null): string {
  return person ? `${person.firstName} ${person.lastName}` : '—';
}

export function initials(person?: PersonRef | null): string {
  if (!person) {
    return '';
  }
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase();
}

export const ROLE_LABELS: Record<RoleName, string> = {
  COLLABORATOR: 'Colaborador',
  EDITOR: 'Editor',
  ADMIN: 'Administrador',
};

export const VERSION_STATUS: Record<VersionStatus, { label: string; chip: string }> = {
  DRAFT: { label: 'Borrador', chip: 'gr' },
  IN_REVIEW: { label: 'En revisión', chip: 'wa' },
  PUBLISHED: { label: 'Publicada', chip: 'ok' },
  REJECTED: { label: 'Rechazada', chip: 'da' },
};

const AREA_CLASSES: [RegExp, string][] = [
  [/operaci/i, 'a-ope'],
  [/comercial|venta/i, 'a-com'],
  [/finanz|administraci/i, 'a-fin'],
  [/tecnolog|ti\b/i, 'a-ti'],
  [/ecosistema|gestor/i, 'a-eco'],
];

export function areaClass(name?: string | null): string {
  const match = AREA_CLASSES.find(([pattern]) => pattern.test(name ?? ''));
  return match ? match[1] : 'a-gen';
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function formatPct(value?: number | null): string {
  return `${(value ?? 0).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
}

export const STEP_STATUS: Record<StepStatus, { label: string; chip: string }> = {
  READ: { label: 'Leído', chip: 'ok' },
  UPDATED: { label: 'Actualizado', chip: 'wa' },
  PENDING: { label: 'Pendiente', chip: 'gr' },
  LOCKED: { label: 'Sin acceso', chip: 'da' },
};

// Usa la fecha local del navegador
export function routeStatus(progress: Progress | null, dueDate: string | null, today = todayInput()): { label: string; tone: string } {
  if (progress && progress.required > 0 && progress.completed >= progress.required) {
    return { label: 'Completada', tone: 'ok' };
  }
  if (!dueDate) {
    return { label: 'Sin fecha límite', tone: 'gr' };
  }
  const due = dueDate.slice(0, 10);
  if (due < today) {
    return { label: 'Atrasada', tone: 'da' };
  }
  const days = (Date.parse(due) - Date.parse(today)) / 86_400_000;
  return days <= 3 ? { label: 'Por vencer', tone: 'wa' } : { label: 'En plazo', tone: '' };
}

export const AUDIT_ACTIONS: Record<string, { label: string; tone: string }> = {
  LOGIN: { label: 'Inicio de sesión', tone: 'gr' },
  LOGOUT: { label: 'Cierre de sesión', tone: 'gr' },
  LOGIN_FAILED: { label: 'Inicio de sesión fallido', tone: 'da' },
  LOGIN_BLOCKED: { label: 'Acceso bloqueado', tone: 'da' },
  ACCESS_DENIED: { label: 'Acceso denegado', tone: 'da' },
  PASSWORD_RESET_REQUEST: { label: 'Solicitud de recuperación', tone: 'gr' },
  PASSWORD_RESET: { label: 'Contraseña restablecida', tone: '' },
  PASSWORD_CHANGE: { label: 'Cambio de contraseña', tone: '' },
  INVITATION_ACCEPTED: { label: 'Invitación aceptada', tone: '' },
  INVITE: { label: 'Invitación reenviada', tone: '' },
  CREATE: { label: 'Creación', tone: '' },
  UPDATE: { label: 'Edición', tone: '' },
  PERMISSION_CHANGE: { label: 'Cambio de permisos', tone: 'wa' },
  ARCHIVE: { label: 'Archivo', tone: 'gr' },
  RESTORE: { label: 'Restauración', tone: 'gr' },
  DELETE: { label: 'Eliminación', tone: 'da' },
  SUBMIT: { label: 'Envío a revisión', tone: '' },
  PUBLISH: { label: 'Publicación', tone: 'ok' },
  REJECT: { label: 'Rechazo', tone: 'da' },
  ASSIGN: { label: 'Asignación de ruta', tone: '' },
  CONFIRM_READ: { label: 'Confirmación de lectura', tone: 'ok' },
};

export const ENTITY_LABELS: Record<string, string> = {
  users: 'Usuario',
  areas: 'Área',
  access_levels: 'Nivel de acceso',
  processes: 'Proceso',
  procedures: 'Procedimiento',
  procedure_versions: 'Versión',
  onboarding_routes: 'Ruta de onboarding',
};
