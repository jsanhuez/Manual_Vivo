<script setup lang="ts">
import { api } from '@/api/http';
import type { MyRoute, OnboardingStep } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import EmptyState from '@/components/EmptyState.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { formatDate, formatDateOnly, formatPct, fullName, routeStatus, STEP_STATUS } from '@/utils/format';

const { data: routes, loading, error } = useRequest(() => api.get<MyRoute[]>('/me/onboarding'));

function nextStep(route: MyRoute): OnboardingStep | undefined {
  return route.steps.find((step) => step.status === 'PENDING' || step.status === 'UPDATED');
}

function stepNote(step: OnboardingStep): string {
  if (step.status === 'READ') {
    return `Confirmado el ${formatDate(step.confirmedAt)} · v${step.currentVersion}`;
  }
  if (step.status === 'UPDATED') {
    return `Leíste la v${step.lastReadVersion} y ahora rige la v${step.currentVersion}, requiere lectura`;
  }
  if (step.status === 'LOCKED') {
    return 'Tu área o nivel de acceso no permite leer este paso';
  }
  return step.processName;
}
</script>

<template>
  <h1>Mi onboarding</h1>
  <p class="sub">Lee cada paso de tu ruta y confirma la lectura de la versión vigente.</p>

  <RequestState :loading="loading" :error="error">
    <template v-if="routes?.length">
      <section v-for="item in routes" :key="item.route.id" class="row mt" :aria-labelledby="`route-${item.route.id}`">
        <div style="flex: 1.8; min-width: 0">
          <h2 :id="`route-${item.route.id}`">{{ item.route.name }}</h2>
          <p class="sub" style="margin-bottom: 12px">
            Asignada el {{ formatDateOnly(item.assignedAt) }} · Ruta creada por {{ fullName(item.route.creator) }}
          </p>
          <ol class="steps">
            <li v-for="step in item.steps" :key="step.procedureId" class="step" :class="{ cur: step === nextStep(item) }">
              <span class="dot" :class="step.status === 'READ' ? 'ok' : step.status === 'UPDATED' ? 'wa' : ''" aria-hidden="true">
                <AppIcon v-if="step.status === 'READ'" name="check" size="sm" />
                <template v-else>{{ step.stepOrder }}</template>
              </span>
              <div style="flex: 1; min-width: 0">
                <span class="code">{{ step.code }}</span> <b>{{ step.title }}</b>
                <div class="sub">{{ stepNote(step) }}<template v-if="!step.isRequired"> · opcional</template></div>
              </div>
              <RouterLink
                v-if="step.status === 'PENDING' || step.status === 'UPDATED'"
                class="btn sm"
                :class="{ sec: step !== nextStep(item) }"
                :to="{ name: 'procedure', params: { id: step.procedureId } }"
              >
                Leer<span class="sr-only"> {{ step.code }}</span>
              </RouterLink>
              <span v-else class="chip" :class="STEP_STATUS[step.status].chip">{{ STEP_STATUS[step.status].label }}</span>
            </li>
          </ol>
        </div>

        <div class="col" style="flex: 1">
          <div class="card" style="text-align: center">
            <h2>Tu progreso</h2>
            <div class="donut" :style="{ '--p': item.progress?.pct ?? 0 }" role="img" :aria-label="`Avance de ${formatPct(item.progress?.pct)}`">
              <span>{{ formatPct(item.progress?.pct) }}</span>
            </div>
            <div class="lst" style="text-align: left; margin-top: 10px">
              <div>
                <span style="flex: 1">Pasos obligatorios</span><b>{{ item.progress?.completed ?? 0 }} / {{ item.progress?.required ?? 0 }}</b>
              </div>
              <div v-if="item.optional.total">
                <span style="flex: 1">Opcionales</span><b>{{ item.optional.completed }} / {{ item.optional.total }}</b>
              </div>
              <div>
                <span style="flex: 1">Fecha límite</span><b>{{ item.dueDate ? formatDateOnly(item.dueDate) : 'Sin fecha' }}</b>
              </div>
              <div>
                <span style="flex: 1">Estado</span>
                <span class="chip" :class="routeStatus(item.progress, item.dueDate).tone">{{ routeStatus(item.progress, item.dueDate).label }}</span>
              </div>
            </div>
          </div>
          <AlertBox tone="info">Si un procedimiento de tu ruta cambia, volverá a quedar pendiente hasta que confirmes la nueva versión.</AlertBox>
        </div>
      </section>
    </template>
    <div v-else class="card mt">
      <EmptyState icon="flag" title="No tienes rutas de onboarding asignadas" text="Cuando te asignen una ruta, verás aquí sus pasos y tu avance." />
    </div>
  </RequestState>
</template>
