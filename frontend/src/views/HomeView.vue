<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api/http';
import type { Dashboard } from '@/api/types';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { useSessionStore } from '@/stores/session';
import { formatDate, formatDateOnly, formatPct, plural } from '@/utils/format';

const session = useSessionStore();
const { data, loading, error } = useRequest(() => api.get<Dashboard>('/dashboard'));

const profileLine = computed(() => {
  const user = session.user;
  if (!user) {
    return '';
  }
  return [user.area.name, user.jobTitle, `Nivel de acceso: ${user.accessLevel.name}`, `Ingreso ${formatDateOnly(user.hireDate)}`]
    .filter(Boolean)
    .join(' · ');
});
const firstRoute = computed(() => data.value?.onboarding[0] ?? null);
</script>

<template>
  <h1>Hola, {{ session.user?.firstName }}</h1>
  <p class="sub">{{ profileLine }}</p>

  <RequestState :loading="loading" :error="error">
    <template v-if="data">
      <div class="grid4 mt">
        <div class="card kpi">
          <div class="l">Procedimientos disponibles para ti</div>
          <div class="v">{{ data.stats.procedures }}</div>
          <div class="l">
            En {{ plural(data.stats.processes, 'proceso', 'procesos') }} de {{ plural(data.stats.areas, 'área', 'áreas') }}
          </div>
        </div>
        <div class="card kpi">
          <div class="l">Lecturas pendientes</div>
          <div class="v" :style="{ color: data.pendingReads.length ? 'var(--wa)' : undefined }">{{ data.pendingReads.length }}</div>
          <div class="l">Actualizaciones o pasos de tu ruta por confirmar</div>
        </div>
        <template v-if="data.management">
          <div class="card kpi">
            <div class="l">Borradores en tus procedimientos</div>
            <div class="v">{{ data.management.drafts }}</div>
            <div class="l">Versiones que aún no envías a revisión</div>
          </div>
          <div v-if="data.management.reviews !== null" class="card kpi">
            <div class="l">Revisiones pendientes</div>
            <div class="v" :style="{ color: data.management.reviews ? 'var(--wa)' : undefined }">{{ data.management.reviews }}</div>
            <RouterLink class="l" :to="{ name: 'reviews' }">Revisar versiones</RouterLink>
          </div>
          <div v-else class="card kpi">
            <div class="l">Versiones en revisión</div>
            <div class="v" :style="{ color: data.management.inReview ? 'var(--wa)' : undefined }">{{ data.management.inReview }}</div>
            <div class="l">Esperan la decisión del administrador</div>
          </div>
        </template>
        <template v-else>
          <div class="card kpi">
            <div class="l">Avance de tu onboarding</div>
            <div class="v">{{ firstRoute ? formatPct(firstRoute.pct) : '—' }}</div>
            <div class="l">{{ firstRoute ? `${firstRoute.completed} de ${firstRoute.required} pasos obligatorios` : 'Sin ruta asignada' }}</div>
          </div>
          <div class="card kpi">
            <div class="l">Procesos que puedes consultar</div>
            <div class="v">{{ data.stats.processes }}</div>
            <div class="l">Según tu área, rol y nivel de acceso</div>
          </div>
        </template>
      </div>

      <div class="row mt">
        <div class="col" style="flex: 1.5">
          <section v-if="data.pendingReads.length" class="card" aria-labelledby="pending-title">
            <h2 id="pending-title">Lecturas pendientes</h2>
            <div class="lst">
              <div v-for="item in data.pendingReads" :key="item.procedureId">
                <span class="chip hide-m" :class="item.changed ? 'wa' : 'gr'">{{ item.changed ? 'Actualizado' : 'De tu ruta' }}</span>
                <div style="flex: 1; min-width: 0">
                  <div>
                    <span class="code">{{ item.code }}</span>
                    <b>{{ item.title }}</b>
                  </div>
                  <div class="sub">v{{ item.versionNumber }} · {{ item.changeSummary }}</div>
                </div>
                <RouterLink class="btn sm" :to="{ name: 'procedure', params: { id: item.procedureId } }">
                  Leer<span class="sr-only"> {{ item.code }}</span>
                </RouterLink>
              </div>
            </div>
          </section>

          <section class="card" aria-labelledby="recent-title">
            <h2 id="recent-title">Actualizaciones recientes</h2>
            <div v-if="data.recentUpdates.length" class="lst">
              <div v-for="update in data.recentUpdates" :key="update.procedure.id">
                <AppIcon name="file" class="hide-m" />
                <div style="flex: 1; min-width: 0">
                  <div>
                    <span class="code">{{ update.procedure.code }}</span>
                    <b>{{ update.procedure.title }}</b>
                  </div>
                  <div class="sub">v{{ update.versionNumber }} · {{ update.changeSummary }}</div>
                </div>
                <span class="sub nowrap hide-m">{{ formatDate(update.publishedAt) }}</span>
                <RouterLink class="btn sm sec" :to="{ name: 'procedure', params: { id: update.procedure.id } }">
                  Ver<span class="sr-only"> {{ update.procedure.code }}</span>
                </RouterLink>
              </div>
            </div>
            <EmptyState v-else icon="book" title="Aún no hay contenido publicado para ti" />
          </section>
        </div>

        <div class="col" style="flex: 1">
          <section v-if="data.onboarding.length" class="card" aria-labelledby="onboarding-title">
            <h2 id="onboarding-title">Mi onboarding</h2>
            <div v-for="item in data.onboarding" :key="item.routeId" style="margin-bottom: 12px">
              <div style="display: flex; gap: 8px; font-size: 13px; margin-bottom: 6px">
                <b style="flex: 1">{{ item.name }}</b><span>{{ formatPct(item.pct) }}</span>
              </div>
              <div class="bar" :class="{ ok: (item.pct ?? 0) >= 100 }"><i :style="{ width: `${item.pct ?? 0}%` }" /></div>
              <p class="sub" style="margin-top: 6px">
                {{ item.completed }} de {{ item.required }} pasos · {{ item.dueDate ? `límite ${formatDateOnly(item.dueDate)}` : 'sin fecha límite' }}
              </p>
            </div>
            <RouterLink class="btn sec sm" :to="{ name: 'onboarding' }"><AppIcon name="flag" size="sm" />Ver mi ruta</RouterLink>
          </section>

          <section class="card" aria-labelledby="quick-title">
            <h2 id="quick-title">Accesos rápidos</h2>
            <div class="lst">
              <RouterLink :to="{ name: 'knowledge' }"><AppIcon name="book" />Base de conocimiento</RouterLink>
              <RouterLink :to="{ name: 'map' }"><AppIcon name="map" />Mapa de procesos</RouterLink>
              <RouterLink :to="{ name: 'search' }"><AppIcon name="search" />Buscar un procedimiento</RouterLink>
              <template v-if="session.canManage">
                <RouterLink :to="{ name: 'procedure-new' }"><AppIcon name="plus" />Nuevo procedimiento</RouterLink>
                <RouterLink :to="{ name: 'manage-routes' }"><AppIcon name="list" />Rutas de onboarding</RouterLink>
                <RouterLink :to="{ name: 'tracking' }"><AppIcon name="bar-chart" />Seguimiento</RouterLink>
              </template>
              <template v-if="session.isAdmin">
                <RouterLink :to="{ name: 'reviews' }"><AppIcon name="check-square" />Revisiones pendientes</RouterLink>
                <RouterLink :to="{ name: 'users' }"><AppIcon name="users" />Usuarios</RouterLink>
                <RouterLink :to="{ name: 'audit' }"><AppIcon name="clipboard" />Auditoría</RouterLink>
              </template>
              <RouterLink :to="{ name: 'profile' }"><AppIcon name="user" />Mi perfil</RouterLink>
            </div>
            <p v-if="session.user" class="sub" style="margin-top: 14px">
              Tu área: <AreaChip :name="session.user.area.name" />
            </p>
          </section>
        </div>
      </div>
    </template>
  </RequestState>
</template>
