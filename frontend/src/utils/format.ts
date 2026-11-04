import type { PersonRef, RoleName, VersionStatus } from '@/api/types';

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
