<script setup lang="ts">
import { api } from '@/api/http';
import type { ProcessDetail } from '@/api/types';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { formatDate, fullName } from '@/utils/format';

const props = defineProps<{ id: number }>();

const { data: process, loading, error } = useRequest(() => api.get<ProcessDetail>(`/processes/${props.id}`));
</script>

<template>
  <RequestState :loading="loading" :error="error">
    <template v-if="process">
      <nav class="bc" aria-label="Ruta de navegación">
        <RouterLink :to="{ name: 'knowledge' }">Base de conocimiento</RouterLink>
        <span aria-hidden="true">›</span>
        <RouterLink :to="{ name: 'knowledge', query: { area: String(process.area.id) } }">{{ process.area.name }}</RouterLink>
        <span aria-hidden="true">›</span>
        <span>{{ process.code }}</span>
      </nav>
      <div class="page-head">
        <div>
          <div class="chips" style="margin-bottom: 6px">
            <span class="code">{{ process.code }}</span>
          </div>
          <h1>{{ process.name }}</h1>
          <div class="chips" style="margin-top: 10px">
            <AreaChip :name="process.area.name" />
            <span v-if="process.isCrossArea" class="chip">Transversal</span>
            <span class="chip gr">Nivel: {{ process.accessLevel.name }}</span>
            <span class="chip gr">Responsable: {{ fullName(process.owner) }}</span>
          </div>
        </div>
        <div v-if="process.canManage" class="actions">
          <RouterLink class="btn sec" :to="{ name: 'process-edit', params: { id: process.id } }"><AppIcon name="edit" />Editar proceso</RouterLink>
          <RouterLink class="btn" :to="{ name: 'procedure-new', query: { processId: String(process.id) } }">
            <AppIcon name="plus" />Nuevo procedimiento
          </RouterLink>
        </div>
      </div>

      <div class="row">
        <section class="card" style="flex: 1.6" aria-labelledby="procedures-title">
          <h2 id="procedures-title">Procedimientos</h2>
          <div v-if="process.procedures.length" class="lst">
            <div v-for="procedure in process.procedures" :key="procedure.id">
              <span class="code">{{ procedure.code }}</span>
              <div style="flex: 1; min-width: 0">
                <RouterLink :to="{ name: 'procedure', params: { id: procedure.id } }" style="font-weight: 700">{{ procedure.title }}</RouterLink>
                <div v-if="procedure.currentVersion" class="sub">
                  Versión {{ procedure.currentVersion.versionNumber }} · {{ formatDate(procedure.currentVersion.publishedAt) }}
                </div>
              </div>
              <span class="chip gr hide-m">{{ procedure.accessLevel.name }}</span>
            </div>
          </div>
          <EmptyState v-else icon="file" title="Este proceso no tiene procedimientos publicados que puedas consultar" />
        </section>

        <section class="card doc" style="flex: 1" aria-labelledby="process-info-title">
          <h2 id="process-info-title" style="font-size: 16px; margin: 0 0 12px">Información del proceso</h2>
          <h3>Objetivo</h3>
          <p>{{ process.objective }}</p>
          <template v-if="process.scope">
            <h3>Alcance</h3>
            <p>{{ process.scope }}</p>
          </template>
          <h3>Áreas con acceso</h3>
          <p v-if="process.isCrossArea">Todas las áreas, porque es un proceso transversal.</p>
          <div v-else class="chips">
            <AreaChip :name="process.area.name" />
            <AreaChip v-for="area in process.visibleAreas" :key="area.id" :name="area.name" />
          </div>
        </section>
      </div>
    </template>
  </RequestState>
</template>
