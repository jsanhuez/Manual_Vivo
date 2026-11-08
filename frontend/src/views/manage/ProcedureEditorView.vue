<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, errorMessages, type ApiError } from '@/api/http';
import type { CreatedProcedure, ManagedProcedure, ManagedProcess, ProcedureEdit, SavedVersion } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import LoadingState from '@/components/LoadingState.vue';
import MarkdownView from '@/components/MarkdownView.vue';
import RequestState from '@/components/RequestState.vue';
import VersionChip from '@/components/VersionChip.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';

const props = defineProps<{ id?: number }>();
const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const catalog = useCatalogStore();
const toast = useToastStore();

const CODE_RULE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const TEMPLATE = '## Objetivo\n\n\n## Pasos\n1. \n\n## Registros\n- ';

const meta = reactive({ processId: 0, code: '', title: '', sortOrder: 1, accessLevelId: 0 });
const savedMeta = ref({ ...meta });
const content = ref('');
const summary = ref('');
const edit = ref<ProcedureEdit | null>(null);
const processes = ref<ManagedProcess[]>([]);
const fieldErrors = reactive<Record<string, string>>({});
const apiErrors = ref<string[]>([]);
const notice = ref('');
const loading = ref(true);
const loadError = ref<ApiError | null>(null);
const saving = ref(false);
const editor = ref<HTMLTextAreaElement | null>(null);
const suggestedCode = ref('');

const isEdit = computed(() => props.id !== undefined);
const openVersion = computed(() => edit.value?.openVersion ?? null);
const inReview = computed(() => openVersion.value?.status === 'IN_REVIEW');
const archived = computed(() => edit.value?.status === 'ARCHIVED');
const readOnly = computed(() => inReview.value || archived.value);
const baseContent = computed(() => openVersion.value?.content ?? edit.value?.currentVersion?.content ?? '');
const baseSummary = computed(() => openVersion.value?.changeSummary ?? '');
const contentChanged = computed(() => content.value !== baseContent.value || (!!openVersion.value && summary.value.trim() !== baseSummary.value));
const metaChanged = computed(() => JSON.stringify(meta) !== JSON.stringify(savedMeta.value));
const nextVersion = computed(
  () => Math.max(edit.value?.currentVersion?.versionNumber ?? 0, edit.value?.lastRejection?.versionNumber ?? 0) + 1,
);
const levelOptions = computed(() =>
  catalog.levels.filter((level) => session.isAdmin || level.level <= (session.user?.accessLevel.level ?? 0)),
);
const selectedProcess = computed(() => processes.value.find((process) => process.id === meta.processId));

async function loadEdit(): Promise<void> {
  const data = await api.get<ProcedureEdit>(`/procedures/${props.id}/edit`);
  edit.value = data;
  Object.assign(meta, {
    processId: data.process.id,
    code: data.code,
    title: data.title,
    sortOrder: data.sortOrder,
    accessLevelId: data.accessLevelId,
  });
  savedMeta.value = { ...meta };
  content.value = data.openVersion?.content ?? data.currentVersion?.content ?? '';
  summary.value = data.openVersion?.changeSummary ?? '';
}

onMounted(async () => {
  try {
    await catalog.load();
    processes.value = (await api.get<ManagedProcess[]>('/processes/manage')).filter((process) => process.status === 'ACTIVE');
    if (isEdit.value) {
      await loadEdit();
    } else {
      content.value = TEMPLATE;
      meta.accessLevelId = levelOptions.value[0]?.id ?? 0;
      const fromQuery = Number(route.query.processId);
      meta.processId = processes.value.some((process) => process.id === fromQuery) ? fromQuery : 0;
    }
  } catch (error) {
    loadError.value = error as ApiError;
  } finally {
    loading.value = false;
  }
});

// Al elegir el proceso se sugiere el siguiente orden y un código correlativo
watch(
  () => meta.processId,
  async (processId) => {
    if (isEdit.value || !processId || !selectedProcess.value) {
      return;
    }
    const siblings = await api.get<ManagedProcedure[]>(`/procedures/manage?processId=${processId}`).catch(() => []);
    const next = Math.max(0, ...siblings.map((procedure) => procedure.sortOrder)) + 1;
    meta.sortOrder = next;
    if (!meta.code || meta.code === suggestedCode.value) {
      suggestedCode.value = `${selectedProcess.value.code}-${String(next).padStart(2, '0')}`;
      meta.code = suggestedCode.value;
    }
  },
);

function wrapSelection(before: string, after: string, placeholder: string): void {
  const area = editor.value;
  if (!area || readOnly.value) {
    return;
  }
  const { selectionStart: start, selectionEnd: end } = area;
  const selected = content.value.slice(start, end) || placeholder;
  content.value = `${content.value.slice(0, start)}${before}${selected}${after}${content.value.slice(end)}`;
  void nextTick(() => {
    area.focus();
    area.setSelectionRange(start + before.length, start + before.length + selected.length);
  });
}

function prefixLines(kind: 'h2' | 'ul' | 'ol'): void {
  const area = editor.value;
  if (!area || readOnly.value) {
    return;
  }
  const start = content.value.lastIndexOf('\n', area.selectionStart - 1) + 1;
  const end = area.selectionEnd;
  const lines = content.value.slice(start, end).split('\n');
  const prefixed = lines.map((line, index) => `${kind === 'h2' ? '## ' : kind === 'ul' ? '- ' : `${index + 1}. `}${line}`).join('\n');
  content.value = `${content.value.slice(0, start)}${prefixed}${content.value.slice(end)}`;
  void nextTick(() => {
    area.focus();
    area.setSelectionRange(start, start + prefixed.length);
  });
}

function onEditorKeydown(event: KeyboardEvent): void {
  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }
  if (event.key === 'b') {
    event.preventDefault();
    wrapSelection('**', '**', 'texto en negrita');
  } else if (event.key === 'i') {
    event.preventDefault();
    wrapSelection('_', '_', 'texto en cursiva');
  }
}

function validate(needsVersion: boolean): boolean {
  meta.code = meta.code.trim().toUpperCase();
  meta.title = meta.title.trim();
  fieldErrors.processId = meta.processId ? '' : 'Selecciona el proceso';
  fieldErrors.code =
    meta.code.length < 3 || meta.code.length > 20
      ? 'El código debe tener entre 3 y 20 caracteres'
      : CODE_RULE.test(meta.code)
        ? ''
        : 'Usa mayúsculas, números y guiones, por ejemplo OPE-P02-03';
  fieldErrors.title = meta.title.length >= 3 && meta.title.length <= 150 ? '' : 'El título debe tener entre 3 y 150 caracteres';
  fieldErrors.sortOrder = Number.isInteger(meta.sortOrder) && meta.sortOrder > 0 && meta.sortOrder <= 32767 ? '' : 'El orden debe ser mayor que 0';
  fieldErrors.accessLevelId = meta.accessLevelId ? '' : 'Selecciona el nivel de acceso';
  fieldErrors.content = !needsVersion || content.value.trim() ? '' : 'El contenido no puede estar vacío';
  const summaryLength = summary.value.trim().length;
  fieldErrors.summary = !needsVersion || (summaryLength >= 5 && summaryLength <= 300) ? '' : 'El resumen de cambios debe tener entre 5 y 300 caracteres';
  return Object.values(fieldErrors).every((message) => !message);
}

async function saveNew(submit: boolean): Promise<void> {
  const created = await api.post<CreatedProcedure>('/procedures', {
    ...meta,
    content: content.value,
    changeSummary: summary.value.trim(),
  });
  if (submit) {
    await api.post(`/versions/${created.openVersion.id}/submit`);
    toast.show(`Se creó ${created.code} y su versión 1 quedó en revisión`);
    await router.push({ name: 'manage-procedures' });
  } else {
    toast.show(`Se creó ${created.code} con su versión 1 en borrador`);
    await router.replace({ name: 'procedure-edit', params: { id: created.id } });
  }
}

async function saveExisting(submit: boolean): Promise<void> {
  const messages: string[] = [];
  if (metaChanged.value) {
    await api.put(`/procedures/${props.id}`, {
      code: meta.code,
      title: meta.title,
      sortOrder: meta.sortOrder,
      accessLevelId: meta.accessLevelId,
    });
    messages.push('Se actualizaron los datos del procedimiento');
  }
  let versionId = openVersion.value?.status === 'DRAFT' ? openVersion.value.id : null;
  let versionNumber = openVersion.value?.versionNumber ?? nextVersion.value;
  if (!readOnly.value && contentChanged.value) {
    const version = await api.post<SavedVersion>(`/procedures/${props.id}/versions`, {
      content: content.value,
      changeSummary: summary.value.trim(),
    });
    versionId = version.id;
    versionNumber = version.versionNumber;
    messages.push(`Se guardó el borrador de la versión ${version.versionNumber}`);
  }
  if (submit && versionId) {
    await api.post(`/versions/${versionId}/submit`);
    messages.push(`La versión ${versionNumber} quedó en revisión`);
  }
  await loadEdit();
  toast.show(messages.length ? messages.join('. ') : 'No había cambios para guardar', messages.length ? 'ok' : 'info');
}

async function save(submit: boolean): Promise<void> {
  apiErrors.value = [];
  notice.value = '';
  const needsVersion = !isEdit.value || (!readOnly.value && (contentChanged.value || submit));
  if (!validate(needsVersion)) {
    return;
  }
  if (isEdit.value && submit && !contentChanged.value && openVersion.value?.status !== 'DRAFT') {
    notice.value = 'Modifica el contenido antes de enviarlo a revisión. Cada envío crea una nueva versión.';
    return;
  }
  saving.value = true;
  try {
    if (isEdit.value) {
      await saveExisting(submit);
    } else {
      await saveNew(submit);
    }
  } catch (error) {
    apiErrors.value = errorMessages(error);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <nav class="bc" aria-label="Ruta de navegación">
    <span>Gestión de contenidos</span><span aria-hidden="true">›</span>
    <RouterLink :to="{ name: 'manage-procedures' }">Procedimientos</RouterLink><span aria-hidden="true">›</span>
    <span>{{ isEdit ? 'Editar' : 'Nuevo' }}</span>
  </nav>
  <div class="page-head">
    <div>
      <h1>{{ isEdit ? 'Editar procedimiento' : 'Nuevo procedimiento' }}</h1>
      <p class="sub">El contenido se guarda como borrador y solo se publica después de la revisión del administrador.</p>
    </div>
    <template v-if="!loading && !loadError">
      <VersionChip v-if="openVersion" :status="openVersion.status" :number="openVersion.versionNumber" />
      <span v-else class="chip gr">{{ isEdit ? `Próxima versión: v${nextVersion}` : 'Versión 1' }}</span>
    </template>
  </div>

  <LoadingState v-if="loading" />
  <RequestState v-else-if="loadError" :loading="false" :error="loadError" />
  <form v-else novalidate @submit.prevent="save(false)">
    <AlertBox tone="da" :messages="apiErrors" style="margin-bottom: 14px" />
    <AlertBox v-if="archived" tone="wa" style="margin-bottom: 14px">
      El procedimiento está archivado. Restáuralo desde el listado para volver a editar su contenido.
    </AlertBox>
    <AlertBox v-else-if="inReview" tone="wa" style="margin-bottom: 14px">
      <b>La versión {{ openVersion?.versionNumber }} está en revisión.</b> Su contenido no se puede modificar hasta que el administrador la apruebe
      o la rechace.
    </AlertBox>
    <AlertBox v-if="edit?.lastRejection && !openVersion" tone="da" style="margin-bottom: 14px">
      <b>La versión {{ edit.lastRejection.versionNumber }} fue rechazada.</b> Observación: {{ edit.lastRejection.reviewNotes }}
    </AlertBox>
    <AlertBox tone="info" :messages="notice || null" style="margin-bottom: 14px" />

    <div class="row">
      <section class="card" style="flex: 1; max-width: 320px" aria-labelledby="meta-title">
        <h2 id="meta-title">Datos del procedimiento</h2>
        <div class="fld">
          <label for="procedure-process">Proceso <span class="req" aria-hidden="true">*</span></label>
          <select
            id="procedure-process"
            v-model.number="meta.processId"
            class="in"
            :class="{ invalid: fieldErrors.processId }"
            :disabled="isEdit"
            :aria-invalid="!!fieldErrors.processId"
          >
            <option :value="0" disabled>Selecciona un proceso</option>
            <option v-if="isEdit && edit" :value="edit.process.id">{{ edit.process.code }} · {{ edit.process.name }}</option>
            <template v-else>
              <option v-for="process in processes" :key="process.id" :value="process.id">{{ process.code }} · {{ process.name }}</option>
            </template>
          </select>
          <p v-if="fieldErrors.processId" class="err">{{ fieldErrors.processId }}</p>
        </div>
        <div class="fld">
          <label for="procedure-code">Código <span class="req" aria-hidden="true">*</span></label>
          <input
            id="procedure-code"
            v-model="meta.code"
            class="in"
            :class="{ invalid: fieldErrors.code }"
            maxlength="20"
            autocomplete="off"
            :aria-invalid="!!fieldErrors.code"
            @blur="meta.code = meta.code.trim().toUpperCase()"
          />
          <p v-if="fieldErrors.code" class="err">{{ fieldErrors.code }}</p>
        </div>
        <div class="fld">
          <label for="procedure-title">Título <span class="req" aria-hidden="true">*</span></label>
          <input
            id="procedure-title"
            v-model="meta.title"
            class="in"
            :class="{ invalid: fieldErrors.title }"
            maxlength="150"
            :aria-invalid="!!fieldErrors.title"
          />
          <p v-if="fieldErrors.title" class="err">{{ fieldErrors.title }}</p>
        </div>
        <div class="fld">
          <label for="procedure-level">Nivel de acceso <span class="req" aria-hidden="true">*</span></label>
          <select
            id="procedure-level"
            v-model.number="meta.accessLevelId"
            class="in"
            :class="{ invalid: fieldErrors.accessLevelId }"
            :aria-invalid="!!fieldErrors.accessLevelId"
            aria-describedby="procedure-level-help"
          >
            <option :value="0" disabled>Selecciona un nivel</option>
            <option v-for="level in levelOptions" :key="level.id" :value="level.id">{{ level.level }} · {{ level.name }}</option>
          </select>
          <p v-if="fieldErrors.accessLevelId" class="err">{{ fieldErrors.accessLevelId }}</p>
          <p v-else id="procedure-level-help" class="help">Visible para quienes tengan acceso al proceso y un nivel igual o superior.</p>
        </div>
        <div class="fld">
          <label for="procedure-order">Orden en el proceso <span class="req" aria-hidden="true">*</span></label>
          <input
            id="procedure-order"
            v-model.number="meta.sortOrder"
            class="in"
            :class="{ invalid: fieldErrors.sortOrder }"
            type="number"
            min="1"
            max="32767"
            :aria-invalid="!!fieldErrors.sortOrder"
          />
          <p v-if="fieldErrors.sortOrder" class="err">{{ fieldErrors.sortOrder }}</p>
        </div>
        <p v-if="isEdit" class="help">Los datos del procedimiento se actualizan al guardar, sin crear una nueva versión.</p>
      </section>

      <div style="flex: 2.4; min-width: 0">
        <label id="content-label" for="procedure-content">Contenido (Markdown con vista previa) <span class="req" aria-hidden="true">*</span></label>
        <div class="ed">
          <div class="tb" role="toolbar" aria-label="Formato del contenido" aria-controls="procedure-content">
            <button type="button" :disabled="readOnly" title="Negrita (Ctrl+B)" @click="wrapSelection('**', '**', 'texto en negrita')">B</button>
            <button type="button" :disabled="readOnly" title="Cursiva (Ctrl+I)" @click="wrapSelection('_', '_', 'texto en cursiva')"><i>I</i></button>
            <button type="button" :disabled="readOnly" title="Subtítulo" @click="prefixLines('h2')">H2</button>
            <button type="button" :disabled="readOnly" title="Lista con viñetas" @click="prefixLines('ul')">• Lista</button>
            <button type="button" :disabled="readOnly" title="Lista numerada" @click="prefixLines('ol')">1. Lista</button>
            <button type="button" :disabled="readOnly" title="Enlace" @click="wrapSelection('[', '](https://)', 'texto del enlace')">Enlace</button>
            <span class="hint hide-m">{{ content.length.toLocaleString('es-CL') }} caracteres</span>
          </div>
          <textarea
            id="procedure-content"
            ref="editor"
            v-model="content"
            class="md"
            :readonly="readOnly"
            spellcheck="true"
            :aria-invalid="!!fieldErrors.content"
            @keydown="onEditorKeydown"
          />
          <div class="pv" aria-live="off">
            <p class="pv-t">Vista previa</p>
            <MarkdownView :source="content" />
          </div>
        </div>
        <p v-if="fieldErrors.content" class="err">{{ fieldErrors.content }}</p>

        <div class="fld" style="margin-top: 12px">
          <label for="procedure-summary">Resumen de cambios (obligatorio)</label>
          <input
            id="procedure-summary"
            v-model="summary"
            class="in"
            :class="{ invalid: fieldErrors.summary }"
            maxlength="300"
            :readonly="readOnly"
            :aria-invalid="!!fieldErrors.summary"
            aria-describedby="procedure-summary-help"
          />
          <p v-if="fieldErrors.summary" class="err">{{ fieldErrors.summary }}</p>
          <p id="procedure-summary-help" class="help">Este resumen se mostrará a los colaboradores en el historial de versiones.</p>
        </div>

        <div class="form-foot">
          <RouterLink class="btn sec" :to="{ name: 'manage-procedures' }">Cancelar</RouterLink>
          <button class="btn sec" type="submit" :disabled="saving || archived">
            <AppIcon name="save" />{{ saving ? 'Guardando…' : 'Guardar borrador' }}
          </button>
          <button class="btn" type="button" :disabled="saving || readOnly" @click="save(true)">
            Enviar a revisión <AppIcon name="send" />
          </button>
        </div>
      </div>
    </div>
  </form>
</template>
