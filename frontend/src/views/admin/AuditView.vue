<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api, query } from '@/api/http';
import type { AdminUser, AuditItem, AuditPage } from '@/api/types';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { AUDIT_ACTIONS, ENTITY_LABELS, formatDateOnly, formatDateTime, fullName } from '@/utils/format';

const FIELD_LABELS: Record<string, string> = { area: 'Área', role: 'Rol', level: 'Nivel', isActive: 'Activa' };

const filters = reactive({ userId: '', action: '', from: '', to: '' });
const applied = ref({ ...filters });
const page = ref(1);
const users = ref<AdminUser[]>([]);

onMounted(async () => {
  users.value = await api.get<AdminUser[]>('/users').catch(() => []);
});

// Inicio del día en la hora local del navegador
function dayStart(date: string, addDays = 0): string | undefined {
  if (!date) {
    return undefined;
  }
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + addDays);
  return value.toISOString();
}

const { data, loading, error, run } = useRequest(() =>
  api.get<AuditPage>(
    `/audit${query({
      userId: applied.value.userId,
      action: applied.value.action,
      from: dayStart(applied.value.from),
      to: dayStart(applied.value.to, 1),
      page: page.value,
    })}`,
  ),
);

const range = computed(() => {
  if (!data.value?.total) {
    return '';
  }
  const first = (data.value.page - 1) * data.value.pageSize + 1;
  return `Mostrando ${first} a ${first + data.value.items.length - 1} de ${data.value.total} eventos`;
});
const lastPage = computed(() => (data.value ? Math.max(1, Math.ceil(data.value.total / data.value.pageSize)) : 1));

function apply(): void {
  applied.value = { ...filters };
  page.value = 1;
  void run();
}

function go(delta: number): void {
  page.value += delta;
  void run();
}

function detail(item: AuditItem, key: string): string {
  const value = item.details?.[key];
  return value === undefined || value === null ? '' : String(value);
}

function entityText(item: AuditItem): string {
  const label = ENTITY_LABELS[item.entity] ?? item.entity;
  // El UUID de un usuario no aporta información
  const fallback = item.entity !== 'users' && item.entityId ? `#${item.entityId}` : '';
  const name = detail(item, 'code') || detail(item, 'email') || detail(item, 'name') || detail(item, 'route') || fallback;
  const version = detail(item, 'version');
  return [label, name, version && `v${version}`].filter(Boolean).join(' ');
}

function detailText(item: AuditItem): string {
  switch (item.action) {
    case 'PERMISSION_CHANGE': {
      const changes = (item.details?.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
      return Object.entries(changes)
        .map(([field, change]) => `${FIELD_LABELS[field] ?? field}: ${String(change.from)} → ${String(change.to)}`)
        .join(' · ');
    }
    case 'PUBLISH':
      return `Publicada · ${detail(item, 'affected') || 0} deben reconfirmar`;
    case 'SUBMIT':
      return 'Borrador → En revisión';
    case 'ASSIGN':
      return `Asignada a ${detail(item, 'email')}${detail(item, 'dueDate') ? ` · límite ${formatDateOnly(detail(item, 'dueDate'))}` : ''}`;
    case 'LOGIN_FAILED':
    case 'LOGIN_BLOCKED':
      return `Cuenta ${detail(item, 'email')}`;
    default:
      return '';
  }
}
</script>

<template>
  <nav class="bc" aria-label="Ruta de navegación"><span>Administración</span><span aria-hidden="true">›</span><span>Auditoría</span></nav>
  <h1>Registro de auditoría</h1>
  <p class="sub">Inicios de sesión, creaciones, ediciones, publicaciones y cambios de permisos, con usuario, fecha e IP.</p>

  <form class="card fgrid mt" novalidate @submit.prevent="apply">
    <div class="fld">
      <label for="audit-user">Usuario</label>
      <select id="audit-user" v-model="filters.userId" class="in">
        <option value="">Todos los usuarios</option>
        <option v-for="user in users" :key="user.id" :value="user.id">{{ fullName(user) }}</option>
      </select>
    </div>
    <div class="fld">
      <label for="audit-action">Acción</label>
      <select id="audit-action" v-model="filters.action" class="in">
        <option value="">Todas las acciones</option>
        <option v-for="(action, key) in AUDIT_ACTIONS" :key="key" :value="key">{{ action.label }}</option>
      </select>
    </div>
    <div class="fld">
      <label for="audit-from">Desde</label>
      <input id="audit-from" v-model="filters.from" class="in" type="date" :max="filters.to || undefined" />
    </div>
    <div class="fld">
      <label for="audit-to">Hasta</label>
      <input id="audit-to" v-model="filters.to" class="in" type="date" :min="filters.from || undefined" />
    </div>
    <button type="submit" class="btn"><AppIcon name="search" />Filtrar</button>
  </form>

  <RequestState :loading="loading" :error="error">
    <div class="card flush mt">
      <div v-if="data?.items.length" class="tw">
        <table>
          <caption class="sr-only">Eventos de auditoría</caption>
          <thead>
            <tr>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Usuario</th>
              <th scope="col">Acción</th>
              <th scope="col">Entidad</th>
              <th scope="col" class="hide-m">Detalle</th>
              <th scope="col" class="hide-m">IP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in data.items" :key="item.id">
              <td class="nowrap">{{ formatDateTime(item.createdAt) }}</td>
              <td>
                <b v-if="item.user">{{ fullName(item.user) }}</b>
                <i v-else class="sub">Sin usuario</i>
              </td>
              <td>
                <span class="chip" :class="AUDIT_ACTIONS[item.action]?.tone">{{ AUDIT_ACTIONS[item.action]?.label ?? item.action }}</span>
              </td>
              <td style="font-size: 12.5px">{{ entityText(item) }}</td>
              <td class="hide-m sub" style="font-size: 12.5px">{{ detailText(item) }}</td>
              <td class="hide-m"><span class="code" style="background: none">{{ item.ipAddress ?? '—' }}</span></td>
            </tr>
          </tbody>
        </table>
        <div class="pag">
          <span style="flex: 1">{{ range }} · registro de solo lectura</span>
          <button type="button" class="ibtn" :disabled="data.page <= 1" aria-label="Página anterior" @click="go(-1)"><AppIcon name="arrow-left" /></button>
          <span>Página {{ data.page }} de {{ lastPage }}</span>
          <button type="button" class="ibtn" :disabled="data.page >= lastPage" aria-label="Página siguiente" @click="go(1)"><AppIcon name="arrow-right" /></button>
        </div>
      </div>
      <EmptyState v-else icon="clipboard" title="No hay eventos para los filtros elegidos" />
    </div>
  </RequestState>
</template>
