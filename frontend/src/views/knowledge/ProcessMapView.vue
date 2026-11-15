<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api/http';
import type { NamedRef, ProcessMap } from '@/api/types';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { areaColor, plural, RELATION_TYPES } from '@/utils/format';

type Edge = ProcessMap['edges'][number];

const COL = 390;
const ROW = 104;
const W = 220;
const H = 64;
const PAD = 24;

const { data: map, loading, error } = useRequest(() => api.get<ProcessMap>('/processes/map'));
const areaId = ref<number | null>(null);
const selectedId = ref<number | null>(null);

const areas = computed(() => {
  const unique = new Map<number, NamedRef>();
  for (const node of map.value?.nodes ?? []) {
    unique.set(node.area.id, node.area);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
});

// Con un área elegida se muestran sus procesos y los que se conectan con ellos
const view = computed(() => {
  const all = map.value ?? { nodes: [], edges: [] };
  if (areaId.value === null) {
    return all;
  }
  const own = new Set(all.nodes.filter((node) => node.area.id === areaId.value).map((node) => node.id));
  const edges = all.edges.filter((edge) => own.has(edge.sourceProcessId) || own.has(edge.targetProcessId));
  const ids = new Set([...own, ...edges.flatMap((edge) => [edge.sourceProcessId, edge.targetProcessId])]);
  return { nodes: all.nodes.filter((node) => ids.has(node.id)), edges };
});

// La columna de cada proceso es el camino más largo desde un proceso sin entradas
const layout = computed(() => {
  const { nodes, edges } = view.value;
  const level = new Map(nodes.map((node) => [node.id, 0]));
  for (let round = 0; round < nodes.length; round++) {
    let changed = false;
    for (const edge of edges) {
      const next = (level.get(edge.sourceProcessId) ?? 0) + 1;
      if (next < nodes.length && next > (level.get(edge.targetProcessId) ?? 0)) {
        level.set(edge.targetProcessId, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  const rows = new Map<number, number>();
  const positions = new Map<number, { x: number; y: number }>();
  for (const node of nodes) {
    const column = level.get(node.id) ?? 0;
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    positions.set(node.id, { x: PAD + column * COL, y: PAD + row * ROW });
  }
  const columns = Math.max(0, ...level.values()) + 1;
  const maxRows = Math.max(1, ...rows.values());
  return { positions, width: PAD * 2 + (columns - 1) * COL + W, height: PAD * 2 + (maxRows - 1) * ROW + H };
});

const nodeById = computed(() => new Map(view.value.nodes.map((node) => [node.id, node])));
const selected = computed(() => (selectedId.value === null ? null : (nodeById.value.get(selectedId.value) ?? null)));

function position(id: number): { x: number; y: number } {
  return layout.value.positions.get(id) ?? { x: 0, y: 0 };
}

function ends(edge: Edge) {
  const from = position(edge.sourceProcessId);
  const to = position(edge.targetProcessId);
  return { x1: from.x + W, y1: from.y + H / 2, x2: to.x, y2: to.y + H / 2 };
}

function edgePath(edge: Edge): string {
  const { x1, y1, x2, y2 } = ends(edge);
  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`;
}

function labelAt(edge: Edge): string {
  const { x1, y1, x2, y2 } = ends(edge);
  return `translate(${(x1 + x2) / 2},${(y1 + y2) / 2})`;
}

function short(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function edgeLabel(edge: Edge): string {
  return edge.description ?? RELATION_TYPES[edge.relationType];
}

function touches(edge: Edge): boolean {
  return selectedId.value !== null && (edge.sourceProcessId === selectedId.value || edge.targetProcessId === selectedId.value);
}

const selectedCounts = computed(() => ({
  incoming: view.value.edges.filter((edge) => edge.targetProcessId === selectedId.value).length,
  outgoing: view.value.edges.filter((edge) => edge.sourceProcessId === selectedId.value).length,
}));
</script>

<template>
  <h1>Mapa de procesos</h1>
  <p class="sub">Conexiones y traspasos de información entre procesos. Solo se muestran los procesos habilitados para tu perfil.</p>

  <RequestState :loading="loading" :error="error">
    <template v-if="map?.nodes.length">
      <div class="tabs mt" role="group" aria-label="Filtrar por área">
        <button type="button" class="tab" :class="{ on: areaId === null }" :aria-pressed="areaId === null" @click="areaId = null">
          Todas las áreas
        </button>
        <button
          v-for="area in areas"
          :key="area.id"
          type="button"
          class="tab"
          :class="{ on: areaId === area.id }"
          :aria-pressed="areaId === area.id"
          @click="areaId = area.id"
        >
          {{ area.name }}
        </button>
      </div>

      <div class="card map">
        <svg
          :viewBox="`0 0 ${layout.width} ${layout.height}`"
          :style="{ maxWidth: `${layout.width}px` }"
          role="group"
          aria-label="Mapa de procesos y sus conexiones"
        >
          <defs>
            <marker id="map-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10z" fill="#64748b" />
            </marker>
          </defs>
          <g v-for="edge in view.edges" :key="edge.id">
            <path :d="edgePath(edge)" fill="none" :stroke="touches(edge) ? '#1d5fa8' : '#94a3b8'" stroke-width="2" marker-end="url(#map-arrow)" />
            <g :transform="labelAt(edge)">
              <rect x="-70" y="-11" width="140" height="22" rx="11" fill="#fff" stroke="#e2e8f0" />
              <text y="4" text-anchor="middle" font-size="11" fill="#475569">{{ short(edgeLabel(edge), 24) }}</text>
            </g>
          </g>
          <g
            v-for="node in view.nodes"
            :key="node.id"
            class="node"
            role="button"
            tabindex="0"
            :aria-label="`${node.code} ${node.name}`"
            :aria-pressed="selectedId === node.id"
            :transform="`translate(${position(node.id).x},${position(node.id).y})`"
            @click="selectedId = node.id"
            @keydown.enter.prevent="selectedId = node.id"
            @keydown.space.prevent="selectedId = node.id"
          >
            <rect class="box" :width="W" :height="H" rx="10" fill="#fff" :style="{ stroke: areaColor(node.area.name) }" :stroke-width="selectedId === node.id ? 3 : 1.6" />
            <rect width="8" :height="H" rx="4" :style="{ fill: areaColor(node.area.name) }" />
            <text x="20" y="26" font-size="12" font-weight="700" :style="{ fill: areaColor(node.area.name) }">{{ node.code }}</text>
            <text x="20" y="46" font-size="12" fill="#1f2937">{{ short(node.name, 30) }}</text>
          </g>
        </svg>
      </div>

      <div class="row mt">
        <div class="card" style="flex: 1.3">
          <template v-if="selected">
            <div class="chips">
              <span class="code">{{ selected.code }}</span>
              <AreaChip :name="selected.area.name" />
              <span v-if="selected.isCrossArea" class="chip">Transversal</span>
            </div>
            <h2 style="margin: 8px 0 4px">{{ selected.name }}</h2>
            <p class="sub" style="margin-bottom: 12px">
              {{ plural(selected.procedureCount, 'procedimiento', 'procedimientos') }} · {{ plural(selectedCounts.incoming, 'entrada', 'entradas') }} ·
              {{ plural(selectedCounts.outgoing, 'salida', 'salidas') }}
            </p>
            <RouterLink class="btn" :to="{ name: 'process', params: { id: selected.id } }">Ver ficha del proceso</RouterLink>
          </template>
          <p v-else class="sub">Selecciona un proceso del mapa para ver su detalle y resaltar sus conexiones.</p>
        </div>
        <section class="card" style="flex: 1.7" aria-labelledby="connections-title">
          <h2 id="connections-title">Conexiones</h2>
          <ul v-if="view.edges.length" class="lst" style="list-style: none">
            <li v-for="edge in view.edges" :key="edge.id" style="flex-wrap: wrap">
              <span class="code">{{ nodeById.get(edge.sourceProcessId)?.code }}</span>
              <AppIcon name="arrow-right" size="sm" />
              <span class="code">{{ nodeById.get(edge.targetProcessId)?.code }}</span>
              <span style="flex: 1; min-width: 160px">{{ edgeLabel(edge) }}</span>
              <span class="chip gr">{{ RELATION_TYPES[edge.relationType] }}</span>
            </li>
          </ul>
          <p v-else class="sub">Aún no hay relaciones registradas entre los procesos que puedes consultar.</p>
        </section>
      </div>
    </template>
    <div v-else class="card mt">
      <EmptyState icon="map" title="No hay procesos para mostrar en el mapa" />
    </div>
  </RequestState>
</template>
