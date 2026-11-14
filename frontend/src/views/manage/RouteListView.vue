<script setup lang="ts">
import { api } from '@/api/http';
import type { RouteSummary } from '@/api/types';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';

const { data: routes, loading, error } = useRequest(() => api.get<RouteSummary[]>('/routes'));
</script>

<template>
  <div class="page-head">
    <div>
      <nav class="bc" aria-label="Ruta de navegación"><span>Gestión de contenidos</span><span aria-hidden="true">›</span><span>Rutas de onboarding</span></nav>
      <h1>Rutas de onboarding</h1>
      <p class="sub">Secuencias de lectura para quienes se incorporan, con pasos obligatorios u opcionales.</p>
    </div>
    <div class="actions">
      <RouterLink class="btn" :to="{ name: 'route-new' }"><AppIcon name="plus" />Nueva ruta</RouterLink>
    </div>
  </div>

  <RequestState :loading="loading" :error="error">
    <div class="card flush">
      <div v-if="routes?.length" class="tw">
        <table>
          <caption class="sr-only">Rutas de onboarding que puedes gestionar</caption>
          <thead>
            <tr>
              <th scope="col">Ruta</th>
              <th scope="col">Área</th>
              <th scope="col">Pasos</th>
              <th scope="col">Asignaciones</th>
              <th scope="col">Estado</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="route in routes" :key="route.id">
              <td>
                <b>{{ route.name }}</b>
                <div v-if="route.description" class="sub">{{ route.description }}</div>
              </td>
              <td>
                <AreaChip v-if="route.area" :name="route.area.name" />
                <span v-else class="chip">Transversal</span>
              </td>
              <td>{{ route.stepCount }} ({{ route.requiredCount }} obligatorios)</td>
              <td>{{ route.assignmentCount }}</td>
              <td>
                <span class="chip" :class="route.isActive ? 'ok' : 'gr'">{{ route.isActive ? 'Activa' : 'Inactiva' }}</span>
              </td>
              <td class="act">
                <RouterLink class="ibtn" :to="{ name: 'route-edit', params: { id: route.id } }" :aria-label="`Editar ${route.name}`" title="Editar">
                  <AppIcon name="edit" />
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState v-else icon="flag" title="Aún no hay rutas de onboarding" text="Crea una ruta con los procedimientos que debe leer una persona nueva." />
    </div>
  </RequestState>
</template>
