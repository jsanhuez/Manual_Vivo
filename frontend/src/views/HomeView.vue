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
import { formatDate, formatDateOnly, plural } from '@/utils/format';

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
</script>

<template>
  <h1>Hola, {{ session.user?.firstName }}</h1>
  <p class="sub">{{ profileLine }}</p>

  <RequestState :loading="loading" :error="error">
    <template v-if="data">
      <div class="grid3 mt">
        <div class="card kpi">
          <div class="l">Procedimientos disponibles para ti</div>
          <div class="v">{{ data.stats.procedures }}</div>
          <div class="l">
            En {{ plural(data.stats.processes, 'proceso', 'procesos') }} de {{ plural(data.stats.areas, 'área', 'áreas') }}
          </div>
        </div>
        <template v-if="data.management">
          <div class="card kpi">
            <div class="l">Borradores en tus procedimientos</div>
            <div class="v">{{ data.management.drafts }}</div>
            <div class="l">Versiones que aún no envías a revisión</div>
          </div>
          <div class="card kpi">
            <div class="l">Versiones en revisión</div>
            <div class="v" style="color: var(--wa)">{{ data.management.inReview }}</div>
            <div class="l">Esperan la decisión del administrador</div>
          </div>
        </template>
        <template v-else>
          <div class="card kpi">
            <div class="l">Procesos que puedes consultar</div>
            <div class="v">{{ data.stats.processes }}</div>
            <div class="l">Según tu área, rol y nivel de acceso</div>
          </div>
          <div class="card kpi">
            <div class="l">Actualizaciones recientes</div>
            <div class="v">{{ data.recentUpdates.length }}</div>
            <div class="l">Últimas versiones publicadas que te aplican</div>
          </div>
        </template>
      </div>

      <div class="row mt">
        <section class="card" style="flex: 1.5" aria-labelledby="recent-title">
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

        <section class="card" style="flex: 1" aria-labelledby="quick-title">
          <h2 id="quick-title">Accesos rápidos</h2>
          <div class="lst">
            <RouterLink :to="{ name: 'knowledge' }"><AppIcon name="book" />Base de conocimiento</RouterLink>
            <RouterLink :to="{ name: 'search' }"><AppIcon name="search" />Buscar un procedimiento</RouterLink>
            <template v-if="session.canManage">
              <RouterLink :to="{ name: 'procedure-new' }"><AppIcon name="plus" />Nuevo procedimiento</RouterLink>
              <RouterLink :to="{ name: 'manage-processes' }"><AppIcon name="folder" />Gestionar procesos</RouterLink>
            </template>
            <template v-if="session.isAdmin">
              <RouterLink :to="{ name: 'users' }"><AppIcon name="users" />Usuarios</RouterLink>
              <RouterLink :to="{ name: 'areas' }"><AppIcon name="layers" />Áreas y niveles</RouterLink>
            </template>
            <RouterLink :to="{ name: 'profile' }"><AppIcon name="user" />Mi perfil</RouterLink>
          </div>
          <p v-if="session.user" class="sub" style="margin-top: 14px">
            Tu área: <AreaChip :name="session.user.area.name" />
          </p>
        </section>
      </div>
    </template>
  </RequestState>
</template>
