<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api, errorMessages, query } from '@/api/http';
import type { AdminUser } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { useCatalogStore } from '@/stores/catalog';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { formatDateTime, fullName, ROLE_LABELS, toDateInput, todayInput } from '@/utils/format';

const catalog = useCatalogStore();
const session = useSessionStore();
const toast = useToastStore();

const filters = reactive({ search: '', areaId: '' as number | '', roleId: '' as number | '', status: '' });
const { data: users, loading, error, run } = useRequest(() =>
  api.get<AdminUser[]>(
    `/users${query({ search: filters.search.trim(), areaId: filters.areaId, roleId: filters.roleId, status: filters.status })}`,
  ),
);

let searchTimer: number | undefined;
watch(
  () => filters.search,
  () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void run(), 300);
  },
);
watch(() => [filters.areaId, filters.roleId, filters.status], () => void run());
onMounted(() => void catalog.load().catch(() => undefined));

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  jobTitle: '',
  hireDate: todayInput(),
  areaId: 0,
  roleId: 0,
  accessLevelId: 0,
  isActive: true,
});

const modalOpen = ref(false);
const editing = ref<AdminUser | null>(null);
const form = reactive(emptyForm());
const fieldErrors = reactive<Record<string, string>>({});
const apiErrors = ref<string[]>([]);
const saving = ref(false);

const isSelf = computed(() => editing.value?.id === session.user?.id);
const activeAreas = computed(() => catalog.areas.filter((area) => area.isActive || area.id === form.areaId));

function openCreate(): void {
  editing.value = null;
  Object.assign(form, emptyForm());
  form.roleId = catalog.roles.find((role) => role.name === 'COLLABORATOR')?.id ?? 0;
  form.accessLevelId = catalog.levels[0]?.id ?? 0;
  apiErrors.value = [];
  Object.keys(fieldErrors).forEach((key) => (fieldErrors[key] = ''));
  modalOpen.value = true;
}

function openEdit(user: AdminUser): void {
  editing.value = user;
  Object.assign(form, {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    jobTitle: user.jobTitle ?? '',
    hireDate: toDateInput(user.hireDate),
    areaId: user.area.id,
    roleId: user.role.id,
    accessLevelId: user.accessLevel.id,
    isActive: user.isActive,
  });
  apiErrors.value = [];
  Object.keys(fieldErrors).forEach((key) => (fieldErrors[key] = ''));
  modalOpen.value = true;
}

function validate(): boolean {
  fieldErrors.firstName = form.firstName.trim() && form.firstName.trim().length <= 60 ? '' : 'Ingresa un nombre de hasta 60 caracteres';
  fieldErrors.lastName = form.lastName.trim() && form.lastName.trim().length <= 60 ? '' : 'Ingresa un apellido de hasta 60 caracteres';
  fieldErrors.email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) && form.email.length <= 120 ? '' : 'Ingresa un correo válido';
  fieldErrors.jobTitle = form.jobTitle.trim().length <= 80 ? '' : 'El cargo admite hasta 80 caracteres';
  fieldErrors.hireDate = /^\d{4}-\d{2}-\d{2}$/.test(form.hireDate) ? '' : 'Ingresa la fecha de ingreso';
  fieldErrors.areaId = form.areaId ? '' : 'Selecciona un área';
  fieldErrors.roleId = form.roleId ? '' : 'Selecciona un rol';
  fieldErrors.accessLevelId = form.accessLevelId ? '' : 'Selecciona un nivel';
  return Object.values(fieldErrors).every((message) => !message);
}

async function save(): Promise<void> {
  apiErrors.value = [];
  if (!validate()) {
    return;
  }
  saving.value = true;
  const payload = {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    jobTitle: form.jobTitle.trim() || null,
    hireDate: form.hireDate,
    areaId: form.areaId,
    roleId: form.roleId,
    accessLevelId: form.accessLevelId,
  };
  try {
    if (editing.value) {
      await api.put(`/users/${editing.value.id}`, { ...payload, isActive: form.isActive });
      toast.show(`Se guardaron los cambios de ${payload.firstName} ${payload.lastName}`);
      if (isSelf.value) {
        await session.refreshProfile();
      }
    } else {
      await api.post('/users', payload);
      toast.show(`Se creó la cuenta y se envió la invitación a ${payload.email}`);
    }
    modalOpen.value = false;
    await run();
  } catch (caught) {
    apiErrors.value = errorMessages(caught);
  } finally {
    saving.value = false;
  }
}

async function resend(user: AdminUser): Promise<void> {
  try {
    await api.post(`/users/${user.id}/invitation`);
    toast.show(`Se reenvió la invitación a ${user.email}`);
  } catch (caught) {
    toast.show(errorMessages(caught).join('. '), 'da');
  }
}

function statusChip(user: AdminUser): { label: string; tone: string } {
  if (!user.isActive) {
    return { label: 'Inactivo', tone: 'gr' };
  }
  return user.invitationPending ? { label: 'Invitación pendiente', tone: 'wa' } : { label: 'Activo', tone: 'ok' };
}
</script>

<template>
  <div class="page-head">
    <div>
      <nav class="bc" aria-label="Ruta de navegación"><span>Administración</span><span aria-hidden="true">›</span><span>Usuarios</span></nav>
      <h1>Usuarios</h1>
      <p class="sub">Cuentas, áreas, roles y niveles de acceso.</p>
    </div>
    <div class="actions">
      <button type="button" class="btn" @click="openCreate"><AppIcon name="plus" />Nuevo usuario</button>
    </div>
  </div>

  <div class="filters">
    <div class="fld">
      <label for="users-search">Buscar por nombre o correo</label>
      <input id="users-search" v-model="filters.search" class="in" type="search" maxlength="100" />
    </div>
    <div class="fld">
      <label for="users-area">Área</label>
      <select id="users-area" v-model="filters.areaId" class="in">
        <option value="">Todas</option>
        <option v-for="area in catalog.areas" :key="area.id" :value="area.id">{{ area.name }}</option>
      </select>
    </div>
    <div class="fld">
      <label for="users-role">Rol</label>
      <select id="users-role" v-model="filters.roleId" class="in">
        <option value="">Todos</option>
        <option v-for="role in catalog.roles" :key="role.id" :value="role.id">{{ ROLE_LABELS[role.name] }}</option>
      </select>
    </div>
    <div class="fld">
      <label for="users-status">Estado</label>
      <select id="users-status" v-model="filters.status" class="in">
        <option value="">Todos</option>
        <option value="active">Activos</option>
        <option value="pending">Invitación pendiente</option>
        <option value="inactive">Inactivos</option>
      </select>
    </div>
  </div>

  <RequestState :loading="loading" :error="error">
    <div class="card flush">
      <div v-if="users?.length" class="tw">
        <table>
          <caption class="sr-only">Usuarios de la plataforma</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Área</th>
              <th scope="col">Rol</th>
              <th scope="col">Nivel</th>
              <th scope="col" class="hide-m">Último ingreso</th>
              <th scope="col">Estado</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <b>{{ fullName(user) }}</b>
                <div class="sub">{{ user.email }}</div>
              </td>
              <td><AreaChip :name="user.area.name" /></td>
              <td>{{ ROLE_LABELS[user.role.name] }}</td>
              <td>{{ user.accessLevel.name }}</td>
              <td class="hide-m sub">{{ formatDateTime(user.lastLoginAt) }}</td>
              <td><span class="chip" :class="statusChip(user).tone">{{ statusChip(user).label }}</span></td>
              <td class="act">
                <button
                  v-if="user.invitationPending && user.isActive"
                  type="button"
                  class="ibtn"
                  :aria-label="`Reenviar invitación a ${user.email}`"
                  title="Reenviar invitación"
                  @click="resend(user)"
                >
                  <AppIcon name="mail" />
                </button>
                <button type="button" class="ibtn" :aria-label="`Editar a ${fullName(user)}`" title="Editar" @click="openEdit(user)">
                  <AppIcon name="edit" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else icon="users" title="No hay usuarios para mostrar" text="Cambia los filtros o crea una cuenta nueva." />
    </div>
  </RequestState>

  <ModalDialog
    :open="modalOpen"
    :title="editing ? 'Editar usuario' : 'Nuevo usuario'"
    :description="editing ? undefined : 'Se enviará un correo para que la persona defina su contraseña.'"
    @close="modalOpen = false"
  >
    <form novalidate @submit.prevent="save">
      <AlertBox tone="da" :messages="apiErrors" style="margin-bottom: 12px" />
      <div class="grid2">
        <div class="fld">
          <label for="user-first">Nombre <span class="req" aria-hidden="true">*</span></label>
          <input id="user-first" v-model="form.firstName" class="in" :class="{ invalid: fieldErrors.firstName }" maxlength="60" />
          <p v-if="fieldErrors.firstName" class="err">{{ fieldErrors.firstName }}</p>
        </div>
        <div class="fld">
          <label for="user-last">Apellido <span class="req" aria-hidden="true">*</span></label>
          <input id="user-last" v-model="form.lastName" class="in" :class="{ invalid: fieldErrors.lastName }" maxlength="60" />
          <p v-if="fieldErrors.lastName" class="err">{{ fieldErrors.lastName }}</p>
        </div>
      </div>
      <div class="grid2">
        <div class="fld">
          <label for="user-email">Correo corporativo <span class="req" aria-hidden="true">*</span></label>
          <input id="user-email" v-model="form.email" class="in" :class="{ invalid: fieldErrors.email }" type="email" maxlength="120" />
          <p v-if="fieldErrors.email" class="err">{{ fieldErrors.email }}</p>
        </div>
        <div class="fld">
          <label for="user-job">Cargo</label>
          <input id="user-job" v-model="form.jobTitle" class="in" :class="{ invalid: fieldErrors.jobTitle }" maxlength="80" />
          <p v-if="fieldErrors.jobTitle" class="err">{{ fieldErrors.jobTitle }}</p>
        </div>
      </div>
      <div class="grid3">
        <div class="fld">
          <label for="user-area">Área <span class="req" aria-hidden="true">*</span></label>
          <select id="user-area" v-model.number="form.areaId" class="in" :class="{ invalid: fieldErrors.areaId }">
            <option :value="0" disabled>Selecciona</option>
            <option v-for="area in activeAreas" :key="area.id" :value="area.id">{{ area.name }}</option>
          </select>
          <p v-if="fieldErrors.areaId" class="err">{{ fieldErrors.areaId }}</p>
        </div>
        <div class="fld">
          <label for="user-role">Rol <span class="req" aria-hidden="true">*</span></label>
          <select id="user-role" v-model.number="form.roleId" class="in" :class="{ invalid: fieldErrors.roleId }" :disabled="isSelf">
            <option :value="0" disabled>Selecciona</option>
            <option v-for="role in catalog.roles" :key="role.id" :value="role.id">{{ ROLE_LABELS[role.name] }}</option>
          </select>
          <p v-if="fieldErrors.roleId" class="err">{{ fieldErrors.roleId }}</p>
        </div>
        <div class="fld">
          <label for="user-level">Nivel de acceso <span class="req" aria-hidden="true">*</span></label>
          <select id="user-level" v-model.number="form.accessLevelId" class="in" :class="{ invalid: fieldErrors.accessLevelId }">
            <option :value="0" disabled>Selecciona</option>
            <option v-for="level in catalog.levels" :key="level.id" :value="level.id">{{ level.level }} · {{ level.name }}</option>
          </select>
          <p v-if="fieldErrors.accessLevelId" class="err">{{ fieldErrors.accessLevelId }}</p>
        </div>
      </div>
      <div class="grid2">
        <div class="fld">
          <label for="user-hire">Fecha de ingreso <span class="req" aria-hidden="true">*</span></label>
          <input id="user-hire" v-model="form.hireDate" class="in" :class="{ invalid: fieldErrors.hireDate }" type="date" />
          <p v-if="fieldErrors.hireDate" class="err">{{ fieldErrors.hireDate }}</p>
        </div>
        <div v-if="editing" class="fld" style="align-self: center">
          <label class="switch" for="user-active">
            <input id="user-active" v-model="form.isActive" type="checkbox" :disabled="isSelf" />
            <span class="tog" aria-hidden="true" />
            <b>Cuenta activa</b>
          </label>
          <p v-if="isSelf" class="help">No puedes desactivar tu cuenta ni cambiar tu propio rol.</p>
        </div>
      </div>
      <div class="form-foot">
        <button type="button" class="btn sec" @click="modalOpen = false">Cancelar</button>
        <button type="submit" class="btn" :disabled="saving">
          {{ saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear y enviar invitación' }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>
