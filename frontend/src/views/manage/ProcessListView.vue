<script setup lang="ts">
import { computed, ref } from 'vue';
import { api, errorMessages } from '@/api/http';
import type { ManagedProcess } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { formatDate, fullName } from '@/utils/format';

const session = useSessionStore();
const toast = useToastStore();
const { data: processes, loading, error, run } = useRequest(() => api.get<ManagedProcess[]>('/processes/manage'));

const text = ref('');
const status = ref<'' | 'ACTIVE' | 'ARCHIVED'>('');
const target = ref<ManagedProcess | null>(null);
const statusErrors = ref<string[]>([]);
const changing = ref(false);

const filtered = computed(() => {
  const term = text.value.trim().toLowerCase();
  return (processes.value ?? []).filter(
    (process) =>
      (!status.value || process.status === status.value) &&
      (!term || process.code.toLowerCase().includes(term) || process.name.toLowerCase().includes(term)),
  );
});

async function toggleStatus(): Promise<void> {
  if (!target.value) {
    return;
  }
  changing.value = true;
  statusErrors.value = [];
  const next = target.value.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
  try {
    await api.patch(`/processes/${target.value.id}/status`, { status: next });
    toast.show(next === 'ARCHIVED' ? `Se archivó ${target.value.code}` : `Se restauró ${target.value.code}`);
    target.value = null;
    await run();
  } catch (caught) {
    statusErrors.value = errorMessages(caught);
  } finally {
    changing.value = false;
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <nav class="bc" aria-label="Ruta de navegación"><span>Gestión de contenidos</span><span aria-hidden="true">›</span><span>Procesos</span></nav>
      <h1>Procesos</h1>
      <p class="sub">
        {{ session.isAdmin ? 'Todos los procesos de la empresa.' : `Procesos del área ${session.user?.area.name} que puedes mantener.` }}
      </p>
    </div>
    <div class="actions">
      <RouterLink class="btn" :to="{ name: 'process-new' }"><AppIcon name="plus" />Nuevo proceso</RouterLink>
    </div>
  </div>

  <div class="filters" style="grid-template-columns: 2fr minmax(0, 1fr)">
    <div class="fld">
      <label for="process-filter">Buscar por código o nombre</label>
      <input id="process-filter" v-model="text" class="in" type="search" placeholder="Por ejemplo: OPE-P02" />
    </div>
    <div class="fld">
      <label for="process-status">Estado</label>
      <select id="process-status" v-model="status" class="in">
        <option value="">Todos</option>
        <option value="ACTIVE">Activos</option>
        <option value="ARCHIVED">Archivados</option>
      </select>
    </div>
  </div>

  <RequestState :loading="loading" :error="error">
    <div class="card flush">
      <div v-if="filtered.length" class="tw">
        <table>
          <caption class="sr-only">Procesos que puedes gestionar</caption>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Proceso</th>
              <th scope="col">Área</th>
              <th scope="col">Nivel</th>
              <th scope="col" class="hide-m">Responsable</th>
              <th scope="col" class="num">Procedimientos</th>
              <th scope="col">Estado</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="process in filtered" :key="process.id">
              <td><span class="code">{{ process.code }}</span></td>
              <td>
                <b>{{ process.name }}</b>
                <div class="sub">Actualizado {{ formatDate(process.updatedAt) }}<template v-if="process.isCrossArea"> · Transversal</template></div>
              </td>
              <td><AreaChip :name="process.area.name" /></td>
              <td>{{ process.accessLevel.name }}</td>
              <td class="hide-m">{{ fullName(process.owner) }}</td>
              <td class="num">{{ process.procedureCount }}</td>
              <td>
                <span class="chip" :class="process.status === 'ACTIVE' ? 'ok' : 'gr'">{{ process.status === 'ACTIVE' ? 'Activo' : 'Archivado' }}</span>
              </td>
              <td class="act">
                <RouterLink
                  v-if="process.status === 'ACTIVE'"
                  class="ibtn"
                  :to="{ name: 'process', params: { id: process.id } }"
                  :aria-label="`Ver ${process.code}`"
                  title="Ver"
                >
                  <AppIcon name="eye" />
                </RouterLink>
                <RouterLink class="ibtn" :to="{ name: 'process-edit', params: { id: process.id } }" :aria-label="`Editar ${process.code}`" title="Editar">
                  <AppIcon name="edit" />
                </RouterLink>
                <button
                  type="button"
                  class="ibtn"
                  :class="{ da: process.status === 'ACTIVE' }"
                  :aria-label="`${process.status === 'ACTIVE' ? 'Archivar' : 'Restaurar'} ${process.code}`"
                  :title="process.status === 'ACTIVE' ? 'Archivar' : 'Restaurar'"
                  @click="target = process"
                >
                  <AppIcon :name="process.status === 'ACTIVE' ? 'archive' : 'restore'" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else icon="folder" title="No hay procesos para mostrar" text="Registra un proceso o cambia los filtros." />
    </div>
  </RequestState>

  <ModalDialog
    :open="target !== null"
    :title="target?.status === 'ACTIVE' ? 'Archivar proceso' : 'Restaurar proceso'"
    @close="target = null"
  >
    <AlertBox tone="da" :messages="statusErrors" style="margin-bottom: 12px" />
    <p v-if="target?.status === 'ACTIVE'">
      ¿Archivar <b>{{ target?.code }} {{ target?.name }}</b>? El proceso y sus procedimientos dejarán de mostrarse en la base de conocimiento, sin
      eliminarse.
    </p>
    <p v-else>¿Restaurar <b>{{ target?.code }} {{ target?.name }}</b>? Volverá a mostrarse según sus reglas de visibilidad.</p>
    <div class="form-foot" style="margin-top: 16px">
      <button type="button" class="btn sec" @click="target = null">Cancelar</button>
      <button type="button" class="btn" :class="{ da: target?.status === 'ACTIVE' }" :disabled="changing" @click="toggleStatus">
        {{ target?.status === 'ACTIVE' ? 'Archivar' : 'Restaurar' }}
      </button>
    </div>
  </ModalDialog>
</template>
