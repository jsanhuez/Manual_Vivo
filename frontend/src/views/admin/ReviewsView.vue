<script setup lang="ts">
import { ref, watch } from 'vue';
import { api, errorMessages } from '@/api/http';
import type { ReviewDetail, ReviewItem } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import EmptyState from '@/components/EmptyState.vue';
import LoadingState from '@/components/LoadingState.vue';
import MarkdownView from '@/components/MarkdownView.vue';
import RequestState from '@/components/RequestState.vue';
import { useRequest } from '@/composables/useRequest';
import { useToastStore } from '@/stores/toast';
import { formatDateTime, fullName, plural } from '@/utils/format';

const toast = useToastStore();
const { data: reviews, loading, error, run } = useRequest(() => api.get<ReviewItem[]>('/versions/in-review'));

const selectedId = ref<number | null>(null);
const detail = ref<ReviewDetail | null>(null);
const detailLoading = ref(false);
const showing = ref<'new' | 'current'>('new');
const notes = ref('');
const notesError = ref('');
const actionErrors = ref<string[]>([]);
const busy = ref(false);

async function select(id: number): Promise<void> {
  selectedId.value = id;
  detail.value = null;
  notes.value = '';
  notesError.value = '';
  actionErrors.value = [];
  showing.value = 'new';
  detailLoading.value = true;
  try {
    detail.value = await api.get<ReviewDetail>(`/versions/${id}/review`);
  } catch (caught) {
    actionErrors.value = errorMessages(caught);
  } finally {
    detailLoading.value = false;
  }
}

// Abre la primera versión pendiente
watch(reviews, (list) => {
  if (list?.length && !list.some((item) => item.id === selectedId.value)) {
    void select(list[0].id);
  } else if (!list?.length) {
    selectedId.value = null;
    detail.value = null;
  }
});

async function publish(): Promise<void> {
  if (!detail.value) {
    return;
  }
  const { procedure, versionNumber, id } = detail.value;
  busy.value = true;
  actionErrors.value = [];
  try {
    const result = await api.post<{ notified: number }>(`/versions/${id}/publish`);
    toast.show(`Se publicó ${procedure.code} v${versionNumber}. Se avisó a ${plural(result.notified, 'persona', 'personas')} para reconfirmar`);
    await run();
  } catch (caught) {
    actionErrors.value = errorMessages(caught);
  } finally {
    busy.value = false;
  }
}

async function reject(): Promise<void> {
  if (!detail.value) {
    return;
  }
  const text = notes.value.trim();
  notesError.value = text.length >= 5 && text.length <= 500 ? '' : 'Escribe una observación de entre 5 y 500 caracteres para el autor';
  if (notesError.value) {
    return;
  }
  const { procedure, versionNumber, id } = detail.value;
  busy.value = true;
  actionErrors.value = [];
  try {
    await api.post(`/versions/${id}/reject`, { reviewNotes: text });
    toast.show(`Se rechazó ${procedure.code} v${versionNumber} y se avisó al autor`);
    await run();
  } catch (caught) {
    actionErrors.value = errorMessages(caught);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <nav class="bc" aria-label="Ruta de navegación"><span>Administración</span><span aria-hidden="true">›</span><span>Revisiones</span></nav>
  <h1>Revisiones pendientes</h1>
  <p class="sub">Versiones enviadas por los editores. Al publicar, se avisa a las personas que deben reconfirmar su lectura.</p>

  <RequestState :loading="loading" :error="error">
    <div v-if="reviews?.length" class="row mt">
      <section class="card flush" style="flex: 1.4" aria-label="Versiones en revisión">
        <div class="tw">
          <table>
            <caption class="sr-only">Versiones en revisión</caption>
            <thead>
              <tr>
                <th scope="col">Procedimiento</th>
                <th scope="col">Versión</th>
                <th scope="col" class="hide-m">Enviada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in reviews" :key="item.id" class="clickable" :class="{ sel: item.id === selectedId }" @click="select(item.id)">
                <td>
                  <span class="code">{{ item.procedure.code }}</span>
                  <div style="margin-top: 3px">
                    <button type="button" class="btn ghost" style="padding: 0; font-weight: 700" :aria-pressed="item.id === selectedId" @click.stop="select(item.id)">
                      {{ item.procedure.title }}
                    </button>
                  </div>
                  <div class="sub" style="margin-top: 4px">
                    {{ fullName(item.author) }} · <AreaChip :name="item.procedure.process.area.name" />
                  </div>
                </td>
                <td><span class="chip">v{{ item.versionNumber }}</span></td>
                <td class="hide-m sub nowrap">{{ formatDateTime(item.submittedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card" style="flex: 1.2" aria-live="polite" aria-label="Detalle de la revisión">
        <LoadingState v-if="detailLoading" />
        <template v-else-if="detail">
          <div class="chips">
            <span class="code">{{ detail.procedure.code }}</span>
            <span class="chip">{{ detail.currentVersion ? `v${detail.currentVersion.versionNumber} → v${detail.versionNumber}` : 'Primera versión' }}</span>
            <span class="chip gr">Nivel: {{ detail.procedure.accessLevel.name }}</span>
          </div>
          <h2 style="margin: 8px 0">{{ detail.procedure.title }}</h2>
          <p class="label">Resumen de cambios</p>
          <p style="margin-bottom: 12px">{{ detail.changeSummary }}</p>
          <div class="lst" style="margin-bottom: 12px">
            <div><span style="flex: 1">Personas que deberán reconfirmar</span><b>{{ detail.impact.users }}</b></div>
            <div><span style="flex: 1">Rutas de onboarding que incluyen el procedimiento</span><b>{{ detail.impact.routes }}</b></div>
            <div><span style="flex: 1">Autor</span><b>{{ fullName(detail.author) }}</b></div>
          </div>

          <div class="tabs" role="group" aria-label="Contenido a revisar">
            <button type="button" class="tab" :class="{ on: showing === 'new' }" :aria-pressed="showing === 'new'" @click="showing = 'new'">
              Nueva versión
            </button>
            <button
              v-if="detail.currentVersion"
              type="button"
              class="tab"
              :class="{ on: showing === 'current' }"
              :aria-pressed="showing === 'current'"
              @click="showing = 'current'"
            >
              Versión vigente
            </button>
          </div>
          <div style="max-height: 320px; overflow: auto; border: 1px solid var(--bd); border-radius: 10px; padding: 12px; margin-bottom: 12px">
            <MarkdownView :source="showing === 'current' && detail.currentVersion ? detail.currentVersion.content : detail.content" />
          </div>

          <AlertBox tone="da" :messages="actionErrors" style="margin-bottom: 12px" />
          <div class="fld">
            <label for="review-notes">Observación (obligatoria si se rechaza)</label>
            <textarea
              id="review-notes"
              v-model="notes"
              class="in"
              :class="{ invalid: notesError }"
              rows="3"
              maxlength="500"
              :aria-invalid="!!notesError"
              placeholder="Escribe una observación para el autor"
            />
            <p v-if="notesError" class="err">{{ notesError }}</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap">
            <button type="button" class="btn da" :disabled="busy" @click="reject"><AppIcon name="x" />Rechazar</button>
            <button type="button" class="btn ok" style="flex: 1" :disabled="busy" @click="publish"><AppIcon name="check" />Aprobar y publicar</button>
          </div>
        </template>
        <AlertBox v-else tone="da" :messages="actionErrors" />
      </section>
    </div>
    <div v-else class="card mt">
      <EmptyState icon="check-square" title="No hay versiones pendientes de revisión" text="Cuando un editor envíe una versión, aparecerá aquí." />
    </div>
  </RequestState>
</template>
