<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessages, query } from '@/api/http';
import type { ManagedProcedure, ManagedProcess } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import RequestState from '@/components/RequestState.vue';
import VersionChip from '@/components/VersionChip.vue';
import { useRequest } from '@/composables/useRequest';
import { useToastStore } from '@/stores/toast';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const processId = ref<number | ''>(typeof route.query.processId === 'string' ? Number(route.query.processId) || '' : '');
const processes = ref<ManagedProcess[]>([]);
const text = ref('');
const target = ref<ManagedProcedure | null>(null);
const statusErrors = ref<string[]>([]);
const changing = ref(false);

const { data: procedures, loading, error, run } = useRequest(() =>
  api.get<ManagedProcedure[]>(`/procedures/manage${query({ processId: processId.value || undefined })}`),
);

onMounted(async () => {
  processes.value = await api.get<ManagedProcess[]>('/processes/manage').catch(() => []);
});

const filtered = computed(() => {
  const term = text.value.trim().toLowerCase();
  return (procedures.value ?? []).filter(
    (procedure) => !term || procedure.code.toLowerCase().includes(term) || procedure.title.toLowerCase().includes(term),
  );
});

function changeProcess(): void {
  void router.replace({ name: 'manage-procedures', query: processId.value ? { processId: String(processId.value) } : {} });
  void run();
}

async function toggleStatus(): Promise<void> {
  if (!target.value) {
    return;
  }
  changing.value = true;
  statusErrors.value = [];
  const next = target.value.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
  try {
    await api.patch(`/procedures/${target.value.id}/status`, { status: next });
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
      <nav class="bc" aria-label="Ruta de navegación"><span>Gestión de contenidos</span><span aria-hidden="true">›</span><span>Procedimientos</span></nav>
      <h1>Procedimientos</h1>
      <p class="sub">Crea procedimientos, edita su contenido como borrador y envíalo a revisión.</p>
    </div>
    <div class="actions">
      <RouterLink class="btn" :to="{ name: 'procedure-new', query: processId ? { processId: String(processId) } : {} }">
        <AppIcon name="plus" />Nuevo procedimiento
      </RouterLink>
    </div>
  </div>

  <div class="filters" style="grid-template-columns: 2fr minmax(0, 1.4fr)">
    <div class="fld">
      <label for="procedure-filter">Buscar por código o título</label>
      <input id="procedure-filter" v-model="text" class="in" type="search" placeholder="Por ejemplo: OPE-P02-01" />
    </div>
    <div class="fld">
      <label for="procedure-process">Proceso</label>
      <select id="procedure-process" v-model="processId" class="in" @change="changeProcess">
        <option value="">Todos los procesos</option>
        <option v-for="process in processes" :key="process.id" :value="process.id">{{ process.code }} · {{ process.name }}</option>
      </select>
    </div>
  </div>

  <RequestState :loading="loading" :error="error">
    <div class="card flush">
      <div v-if="filtered.length" class="tw">
        <table>
          <caption class="sr-only">Procedimientos que puedes gestionar</caption>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Procedimiento</th>
              <th scope="col">Nivel</th>
              <th scope="col">Vigente</th>
              <th scope="col">En curso</th>
              <th scope="col">Estado</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="procedure in filtered" :key="procedure.id">
              <td><span class="code">{{ procedure.code }}</span></td>
              <td>
                <b>{{ procedure.title }}</b>
                <div class="sub">{{ procedure.process.code }} · {{ procedure.process.name }}</div>
              </td>
              <td>{{ procedure.accessLevel.name }}</td>
              <td>
                <span v-if="procedure.currentVersion" class="chip ok">v{{ procedure.currentVersion.versionNumber }}</span>
                <span v-else class="sub">Sin publicar</span>
              </td>
              <td>
                <VersionChip v-if="procedure.openVersion" :status="procedure.openVersion.status" :number="procedure.openVersion.versionNumber" />
                <VersionChip
                  v-else-if="procedure.latestVersion?.status === 'REJECTED'"
                  status="REJECTED"
                  :number="procedure.latestVersion.versionNumber"
                />
                <span v-else class="sub">—</span>
              </td>
              <td>
                <span class="chip" :class="procedure.status === 'ACTIVE' ? 'ok' : 'gr'">{{ procedure.status === 'ACTIVE' ? 'Activo' : 'Archivado' }}</span>
              </td>
              <td class="act">
                <RouterLink
                  v-if="procedure.currentVersion && procedure.status === 'ACTIVE' && procedure.process.status === 'ACTIVE'"
                  class="ibtn"
                  :to="{ name: 'procedure', params: { id: procedure.id } }"
                  :aria-label="`Ver ${procedure.code}`"
                  title="Ver"
                >
                  <AppIcon name="eye" />
                </RouterLink>
                <RouterLink
                  class="ibtn"
                  :to="{ name: 'procedure-edit', params: { id: procedure.id } }"
                  :aria-label="`Editar ${procedure.code}`"
                  title="Editar"
                >
                  <AppIcon name="edit" />
                </RouterLink>
                <button
                  type="button"
                  class="ibtn"
                  :class="{ da: procedure.status === 'ACTIVE' }"
                  :aria-label="`${procedure.status === 'ACTIVE' ? 'Archivar' : 'Restaurar'} ${procedure.code}`"
                  :title="procedure.status === 'ACTIVE' ? 'Archivar' : 'Restaurar'"
                  @click="target = procedure"
                >
                  <AppIcon :name="procedure.status === 'ACTIVE' ? 'archive' : 'restore'" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else icon="file" title="No hay procedimientos para mostrar" text="Crea un procedimiento o cambia los filtros." />
    </div>
  </RequestState>

  <ModalDialog
    :open="target !== null"
    :title="target?.status === 'ACTIVE' ? 'Archivar procedimiento' : 'Restaurar procedimiento'"
    @close="target = null"
  >
    <AlertBox tone="da" :messages="statusErrors" style="margin-bottom: 12px" />
    <p v-if="target?.status === 'ACTIVE'">
      ¿Archivar <b>{{ target?.code }} {{ target?.title }}</b>? Dejará de mostrarse en la base de conocimiento y se conservarán sus versiones.
    </p>
    <p v-else>¿Restaurar <b>{{ target?.code }} {{ target?.title }}</b>?</p>
    <div class="form-foot" style="margin-top: 16px">
      <button type="button" class="btn sec" @click="target = null">Cancelar</button>
      <button type="button" class="btn" :class="{ da: target?.status === 'ACTIVE' }" :disabled="changing" @click="toggleStatus">
        {{ target?.status === 'ACTIVE' ? 'Archivar' : 'Restaurar' }}
      </button>
    </div>
  </ModalDialog>
</template>
