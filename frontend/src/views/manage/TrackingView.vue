<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api/http';
import type { CoverageRow, RouteProgressRow } from '@/api/types';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { useSessionStore } from '@/stores/session';
import { downloadCsv } from '@/utils/csv';
import { formatDate, formatDateOnly, formatPct, fullName, routeStatus, todayInput } from '@/utils/format';

const session = useSessionStore();
const { data, loading, error } = useRequest(async () => {
  const [routes, coverage] = await Promise.all([
    api.get<RouteProgressRow[]>('/tracking/routes'),
    api.get<CoverageRow[]>('/tracking/coverage'),
  ]);
  return { routes, coverage };
});

const kpis = computed(() => {
  const routes = data.value?.routes ?? [];
  const coverage = data.value?.coverage ?? [];
  const audience = coverage.reduce((sum, row) => sum + row.audience, 0);
  const confirmed = coverage.reduce((sum, row) => sum + row.confirmed, 0);
  return {
    people: new Set(routes.map((row) => row.userId)).size,
    average: routes.length ? routes.reduce((sum, row) => sum + (row.pct ?? 0), 0) / routes.length : null,
    pending: audience - confirmed,
    coverage: audience ? (100 * confirmed) / audience : null,
  };
});

function coveragePct(row: CoverageRow): number {
  return row.audience ? (100 * row.confirmed) / row.audience : 0;
}

function tone(value: number): string {
  return value >= 80 ? 'ok' : value >= 50 ? 'wa' : 'da';
}

const decimal = (value: number) => (Math.round(value * 10) / 10).toLocaleString('es-CL');

function exportRoutes(): void {
  downloadCsv(`avance-onboarding-${todayInput()}.csv`, [
    ['Colaborador', 'Área', 'Ruta', 'Asignada', 'Fecha límite', 'Pasos completados', 'Pasos obligatorios', 'Avance (%)', 'Estado'],
    ...(data.value?.routes ?? []).map((row) => [
      fullName(row),
      row.areaName,
      row.routeName,
      formatDateOnly(row.assignedAt),
      row.dueDate ? formatDateOnly(row.dueDate) : '',
      row.completed,
      row.required,
      decimal(row.pct ?? 0),
      routeStatus(row, row.dueDate).label,
    ]),
  ]);
}

function exportCoverage(): void {
  downloadCsv(`cobertura-lectura-${todayInput()}.csv`, [
    ['Código', 'Procedimiento', 'Versión vigente', 'Publicada', 'Deben leerla', 'Confirmaron', 'Cobertura (%)'],
    ...(data.value?.coverage ?? []).map((row) => [
      row.code,
      row.title,
      row.versionNumber,
      formatDate(row.publishedAt),
      row.audience,
      row.confirmed,
      decimal(coveragePct(row)),
    ]),
  ]);
}
</script>

<template>
  <div class="page-head">
    <div>
      <nav class="bc" aria-label="Ruta de navegación"><span>Gestión de contenidos</span><span aria-hidden="true">›</span><span>Seguimiento</span></nav>
      <h1>Seguimiento</h1>
      <p class="sub">
        Avance de onboarding y cobertura de lectura de las versiones vigentes{{ session.isAdmin ? '' : ` del área ${session.user?.area.name}` }}.
      </p>
    </div>
    <div v-if="data" class="actions">
      <button type="button" class="btn sec" :disabled="!data.routes.length" @click="exportRoutes"><AppIcon name="download" />Avance (CSV)</button>
      <button type="button" class="btn sec" :disabled="!data.coverage.length" @click="exportCoverage"><AppIcon name="download" />Cobertura (CSV)</button>
    </div>
  </div>

  <RequestState :loading="loading" :error="error">
    <template v-if="data">
      <div class="grid4">
        <div class="card kpi">
          <div class="l">Personas en onboarding</div>
          <div class="v">{{ kpis.people }}</div>
        </div>
        <div class="card kpi">
          <div class="l">Avance promedio</div>
          <div class="v">{{ kpis.average === null ? '—' : formatPct(kpis.average) }}</div>
        </div>
        <div class="card kpi">
          <div class="l">Lecturas pendientes</div>
          <div class="v" :style="{ color: kpis.pending ? 'var(--wa)' : undefined }">{{ kpis.pending }}</div>
          <div class="l">{{ session.isAdmin ? 'En todos los procedimientos' : 'En los procedimientos que gestionas' }}</div>
        </div>
        <div class="card kpi">
          <div class="l">Cobertura de lectura vigente</div>
          <div class="v" style="color: var(--ok)">{{ kpis.coverage === null ? '—' : formatPct(kpis.coverage) }}</div>
        </div>
      </div>

      <div class="row mt">
        <section class="card flush" style="flex: 1.8" aria-labelledby="progress-title">
          <h2 id="progress-title" style="padding: 14px 16px 0">Avance por persona y ruta</h2>
          <div v-if="data.routes.length" class="tw">
            <table>
              <caption class="sr-only">Avance de onboarding por persona y ruta</caption>
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Ruta</th>
                  <th scope="col">Avance</th>
                  <th scope="col">Pasos</th>
                  <th scope="col">Límite</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in data.routes" :key="`${row.routeId}-${row.userId}`">
                  <td>
                    <b>{{ fullName(row) }}</b>
                    <div class="sub">{{ row.areaName }}</div>
                  </td>
                  <td>{{ row.routeName }}</td>
                  <td style="min-width: 150px">
                    <div style="display: flex; align-items: center; gap: 8px">
                      <div class="bar" :class="{ ok: (row.pct ?? 0) >= 100 }" style="flex: 1"><i :style="{ width: `${row.pct ?? 0}%` }" /></div>
                      <b>{{ formatPct(row.pct) }}</b>
                    </div>
                  </td>
                  <td>{{ row.completed }}/{{ row.required }}</td>
                  <td class="nowrap">{{ row.dueDate ? formatDateOnly(row.dueDate) : '—' }}</td>
                  <td><span class="chip" :class="routeStatus(row, row.dueDate).tone">{{ routeStatus(row, row.dueDate).label }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <EmptyState v-else icon="flag" title="No hay rutas asignadas" text="Asigna una ruta desde Rutas de onboarding." />
        </section>

        <section class="card" style="flex: 1" aria-labelledby="coverage-title">
          <h2 id="coverage-title">Cobertura de lectura de la versión vigente</h2>
          <p class="sub" style="margin-bottom: 12px">Personas que confirmaron la versión vigente entre quienes leyeron una versión anterior o la tienen en su ruta.</p>
          <template v-if="data.coverage.length">
            <div v-for="row in data.coverage" :key="row.procedureId" style="margin-bottom: 12px">
              <div style="display: flex; gap: 8px; font-size: 12.5px; margin-bottom: 5px">
                <span style="flex: 1"><span class="code">{{ row.code }}</span> {{ row.title }} (v{{ row.versionNumber }})</span>
                <b>{{ row.confirmed }}/{{ row.audience }}</b>
              </div>
              <div class="bar" :class="tone(coveragePct(row))" role="img" :aria-label="`Cobertura de ${formatPct(coveragePct(row))}`">
                <i :style="{ width: `${coveragePct(row)}%` }" />
              </div>
            </div>
          </template>
          <p v-else class="sub">Aún no hay lecturas registradas en los procedimientos que gestionas.</p>
        </section>
      </div>
    </template>
  </RequestState>
</template>
