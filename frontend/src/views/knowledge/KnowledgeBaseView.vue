<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, query } from '@/api/http';
import type { ProcessList } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { useCatalogStore } from '@/stores/catalog';
import { formatDate, plural } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const catalog = useCatalogStore();

const sort = ref<'code' | 'recent' | 'name'>('code');

const areaId = computed(() => (typeof route.query.area === 'string' ? Number(route.query.area) || undefined : undefined));
const crossArea = computed(() => route.query.tipo === 'transversal');

const { data, loading, error, run } = useRequest(
  () => api.get<ProcessList>(`/processes${query({ areaId: areaId.value, crossArea: crossArea.value || undefined })}`),
);

watch(() => [route.query.area, route.query.tipo], run);
onMounted(() => void catalog.load().catch(() => undefined));

interface Tab {
  key: string;
  label: string;
  query: Record<string, string>;
}

const tabs = computed(() => {
  const list: Tab[] = [{ key: 'all', label: 'Todas', query: {} }];
  for (const area of catalog.areas.filter((item) => item.isActive)) {
    list.push({ key: `a${area.id}`, label: area.name, query: { area: String(area.id) } });
  }
  list.push({ key: 'cross', label: 'Transversales', query: { tipo: 'transversal' } });
  return list;
});
const activeTab = computed(() => (crossArea.value ? 'cross' : areaId.value ? `a${areaId.value}` : 'all'));

const items = computed(() => {
  const list = [...(data.value?.items ?? [])];
  if (sort.value === 'recent') {
    return list.sort((a, b) => (b.lastUpdatedAt ?? '').localeCompare(a.lastUpdatedAt ?? ''));
  }
  if (sort.value === 'name') {
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  return list;
});

const hiddenMessage = computed(() => {
  const hidden = data.value?.hiddenCount ?? 0;
  if (!hidden) {
    return null;
  }
  const total = (data.value?.items.length ?? 0) + hidden;
  return `Se muestran ${data.value?.items.length} de ${plural(total, 'proceso', 'procesos')}. Los demás requieren un nivel de acceso o un área distinta a la tuya.`;
});

function selectTab(tab: Tab): void {
  void router.replace({ name: 'knowledge', query: tab.query });
}
</script>

<template>
  <div class="page-head">
    <div>
      <h1>Base de conocimiento</h1>
      <p class="sub">Procesos y procedimientos vigentes habilitados para tu área, rol y nivel de acceso.</p>
    </div>
    <div class="hide-m" style="width: 220px">
      <label for="kb-sort" class="sr-only">Ordenar procesos</label>
      <select id="kb-sort" v-model="sort" class="in">
        <option value="code">Ordenar: código</option>
        <option value="recent">Ordenar: más recientes</option>
        <option value="name">Ordenar: nombre</option>
      </select>
    </div>
  </div>

  <div class="tabs" role="group" aria-label="Filtrar por área">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="tab"
      :class="{ on: activeTab === tab.key }"
      :aria-pressed="activeTab === tab.key"
      @click="selectTab(tab)"
    >
      {{ tab.label }}
    </button>
  </div>

  <RequestState :loading="loading" :error="error">
    <div v-if="items.length" class="grid3">
      <article v-for="process in items" :key="process.id" class="card pc">
        <div class="chips">
          <span class="code">{{ process.code }}</span>
          <AreaChip :name="process.area.name" />
          <span v-if="process.isCrossArea" class="chip">Transversal</span>
          <span class="chip gr" style="margin-left: auto"><AppIcon name="lock" size="sm" />{{ process.accessLevel.name }}</span>
        </div>
        <RouterLink class="t" :to="{ name: 'process', params: { id: process.id } }">{{ process.name }}</RouterLink>
        <p class="d">{{ process.objective }}</p>
        <div class="m">
          <span><AppIcon name="file" size="sm" />{{ plural(process.procedureCount, 'procedimiento', 'procedimientos') }}</span>
          <span><AppIcon name="clock" size="sm" />Actualizado {{ formatDate(process.lastUpdatedAt) }}</span>
        </div>
      </article>
    </div>
    <div v-else class="card">
      <EmptyState icon="book" title="No hay procesos para mostrar" text="Prueba con otra área o revisa los procesos transversales." />
    </div>
    <AlertBox v-if="hiddenMessage" tone="info" :messages="hiddenMessage" style="margin-top: 14px" />
  </RequestState>
</template>
