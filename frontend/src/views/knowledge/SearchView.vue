<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, query } from '@/api/http';
import type { SearchResult } from '@/api/types';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { useCatalogStore } from '@/stores/catalog';
import { formatDate, plural } from '@/utils/format';
import { highlightSnippet } from '@/utils/markdown';

const route = useRoute();
const router = useRouter();
const catalog = useCatalogStore();

const term = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''));
const areaId = computed(() => (typeof route.query.area === 'string' ? Number(route.query.area) || undefined : undefined));

const text = ref(term.value);
const area = ref<number | ''>(areaId.value ?? '');

const { data: results, loading, error, run } = useRequest(
  () => api.get<SearchResult[]>(`/search${query({ q: term.value, areaId: areaId.value })}`),
  false,
);

function load(): void {
  if (term.value.length >= 2) {
    void run();
  } else {
    results.value = null;
  }
}

watch(() => [route.query.q, route.query.area], () => {
  text.value = term.value;
  area.value = areaId.value ?? '';
  load();
});

onMounted(() => {
  load();
  void catalog.load().catch(() => undefined);
});

function submit(): void {
  void router.replace({ name: 'search', query: { q: text.value.trim() || undefined, area: area.value ? String(area.value) : undefined } });
}
</script>

<template>
  <h1>Buscar</h1>
  <p class="sub">Busca por palabras clave en el título y en la versión vigente de los procedimientos que puedes consultar.</p>

  <form class="card mt" role="search" novalidate @submit.prevent="submit">
    <div class="filters" style="grid-template-columns: 3fr minmax(0, 1.2fr) auto; margin-bottom: 0">
      <div class="fld">
        <label for="search-text">Palabras clave</label>
        <input id="search-text" v-model="text" class="in" type="search" minlength="2" maxlength="100" placeholder="Por ejemplo: retiro" />
      </div>
      <div class="fld">
        <label for="search-area">Área del proceso</label>
        <select id="search-area" v-model="area" class="in">
          <option value="">Todas las áreas</option>
          <option v-for="item in catalog.areas" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>
      <button class="btn" type="submit" style="height: 38px"><AppIcon name="search" />Buscar</button>
    </div>
  </form>

  <div class="mt">
    <div v-if="term.length < 2" class="card">
      <EmptyState icon="search" title="Escribe al menos dos caracteres" text="La búsqueda considera el español, por ejemplo «retiros» también encuentra «retiro»." />
    </div>
    <RequestState v-else :loading="loading" :error="error">
      <p class="sub" style="margin-bottom: 10px" aria-live="polite">
        {{ plural(results?.length ?? 0, 'resultado', 'resultados') }} para «{{ term }}»
      </p>
      <div v-if="results?.length" class="card">
        <div class="lst">
          <article v-for="result in results" :key="result.id" class="result" style="align-items: stretch">
            <div class="chips">
              <span class="code">{{ result.code }}</span>
              <RouterLink :to="{ name: 'procedure', params: { id: result.id } }" style="font-weight: 700; font-size: 14.5px">
                {{ result.title }}
              </RouterLink>
            </div>
            <p class="snip" v-html="highlightSnippet(result.snippet)" />
            <div class="chips sub">
              <AreaChip :name="result.areaName" />
              <span>{{ result.processCode }} · {{ result.processName }}</span>
              <span>· Versión {{ result.versionNumber }} del {{ formatDate(result.publishedAt) }}</span>
            </div>
          </article>
        </div>
      </div>
      <div v-else class="card">
        <EmptyState icon="search" title="Sin resultados" text="Prueba con otras palabras o revisa la base de conocimiento." />
      </div>
    </RequestState>
  </div>
</template>
