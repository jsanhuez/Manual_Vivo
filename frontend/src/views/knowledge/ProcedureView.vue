<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api, type ApiError, errorMessages } from '@/api/http';
import type { ProcedureDetail, VersionDetail } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import LoadingState from '@/components/LoadingState.vue';
import MarkdownView from '@/components/MarkdownView.vue';
import RequestState from '@/components/RequestState.vue';
import VersionChip from '@/components/VersionChip.vue';
import { useRequest } from '@/composables/useRequest';
import { formatDate, fullName } from '@/utils/format';

const props = defineProps<{ id: number }>();
const route = useRoute();

const { data: procedure, loading, error } = useRequest(() => api.get<ProcedureDetail>(`/procedures/${props.id}`));

const requestedVersion = computed(() => {
  const value = Number(route.query.version);
  return Number.isInteger(value) && value > 0 ? value : null;
});
const oldVersion = ref<VersionDetail | null>(null);
const oldLoading = ref(false);
const oldError = ref<string[]>([]);

// Una versión anterior se consulta aparte y se muestra en modo de solo lectura (CU-04 flujo 3a)
watch(
  [requestedVersion, procedure],
  async ([version, detail]) => {
    oldVersion.value = null;
    oldError.value = [];
    if (!version || !detail || version === detail.currentVersion?.versionNumber) {
      return;
    }
    oldLoading.value = true;
    try {
      oldVersion.value = await api.get<VersionDetail>(`/procedures/${props.id}/versions/${version}`);
    } catch (caught) {
      oldError.value = errorMessages(caught as ApiError);
    } finally {
      oldLoading.value = false;
    }
  },
  { immediate: true },
);

const shown = computed(() => oldVersion.value ?? procedure.value?.currentVersion ?? null);
</script>

<template>
  <RequestState :loading="loading" :error="error">
    <template v-if="procedure">
      <nav class="bc" aria-label="Ruta de navegación">
        <RouterLink :to="{ name: 'knowledge' }">Base de conocimiento</RouterLink>
        <span aria-hidden="true">›</span>
        <RouterLink :to="{ name: 'knowledge', query: { area: String(procedure.process.area.id) } }">{{ procedure.process.area.name }}</RouterLink>
        <span aria-hidden="true">›</span>
        <RouterLink :to="{ name: 'process', params: { id: procedure.process.id } }">
          {{ procedure.process.code }} {{ procedure.process.name }}
        </RouterLink>
      </nav>

      <div class="page-head" style="margin-bottom: 4px">
        <div>
          <div class="chips">
            <span class="code">{{ procedure.code }}</span>
            <h1 style="margin: 0">{{ procedure.title }}</h1>
          </div>
        </div>
        <div v-if="procedure.canManage" class="actions">
          <RouterLink class="btn sec" :to="{ name: 'procedure-edit', params: { id: procedure.id } }"><AppIcon name="edit" />Editar</RouterLink>
        </div>
      </div>

      <div class="chips" style="margin: 10px 0 14px">
        <span v-if="procedure.currentVersion" class="chip">
          Versión {{ procedure.currentVersion.versionNumber }} · vigente desde {{ formatDate(procedure.currentVersion.publishedAt) }}
        </span>
        <span v-else class="chip wa">Sin versión publicada</span>
        <AreaChip :name="procedure.process.area.name" />
        <span class="chip gr">Nivel: {{ procedure.accessLevel.name }}</span>
        <span class="chip gr">Responsable: {{ fullName(procedure.process.owner) }}</span>
      </div>

      <AlertBox v-if="oldVersion" tone="wa" style="margin-bottom: 14px">
        <b>Estás viendo la versión {{ oldVersion.versionNumber }}, publicada el {{ formatDate(oldVersion.publishedAt) }}.</b>
        No es la versión vigente.
        <RouterLink :to="{ name: 'procedure', params: { id: procedure.id } }">Ver la versión vigente</RouterLink>
      </AlertBox>
      <AlertBox tone="da" :messages="oldError" style="margin-bottom: 14px" />

      <div class="row">
        <article class="card" style="flex: 1.7" aria-label="Contenido del procedimiento">
          <LoadingState v-if="oldLoading" />
          <template v-else-if="shown">
            <MarkdownView :source="shown.content" />
            <p class="help" style="margin-top: 16px; border-top: 1px solid var(--bd); padding-top: 10px">
              Versión {{ shown.versionNumber }} · {{ shown.changeSummary }} · Autor: {{ fullName(shown.author) }}
            </p>
          </template>
          <EmptyState
            v-else
            icon="file"
            title="Este procedimiento aún no tiene una versión publicada"
            text="Puedes revisar su borrador desde el editor."
          />
        </article>

        <div class="col" style="flex: 1">
          <section v-if="procedure.history.length" class="card" aria-labelledby="history-title">
            <h2 id="history-title">Historial de versiones</h2>
            <div class="lst">
              <RouterLink
                v-for="version in procedure.history"
                :key="version.id"
                class="version-item"
                :to="{ name: 'procedure', params: { id: procedure.id }, query: version.versionNumber === procedure.currentVersion?.versionNumber ? {} : { version: String(version.versionNumber) } }"
                :aria-current="shown?.versionNumber === version.versionNumber ? 'true' : undefined"
              >
                <span class="chip" :class="version.versionNumber === procedure.currentVersion?.versionNumber ? '' : 'gr'">v{{ version.versionNumber }}</span>
                <span class="vt" style="color: var(--tx)">{{ version.changeSummary }}</span>
                <span class="sub nowrap">{{ formatDate(version.publishedAt) }}</span>
              </RouterLink>
            </div>
          </section>

          <section v-if="procedure.canManage" class="card" aria-labelledby="workflow-title">
            <h2 id="workflow-title">Versiones en curso</h2>
            <div v-if="procedure.workflow.length" class="lst">
              <div v-for="version in procedure.workflow" :key="version.id" style="align-items: flex-start">
                <VersionChip :status="version.status" :number="version.versionNumber" />
                <div class="vt">
                  {{ version.changeSummary }}
                  <div class="sub">{{ fullName(version.author) }} · {{ formatDate(version.createdAt) }}</div>
                  <div v-if="version.reviewNotes" class="err" style="font-weight: 400">Observación: {{ version.reviewNotes }}</div>
                </div>
              </div>
            </div>
            <p v-else class="sub">No hay borradores ni versiones en revisión.</p>
            <RouterLink class="btn sec sm" style="margin-top: 12px" :to="{ name: 'procedure-edit', params: { id: procedure.id } }">
              <AppIcon name="edit" size="sm" />Abrir en el editor
            </RouterLink>
          </section>
        </div>
      </div>
    </template>
  </RequestState>
</template>
