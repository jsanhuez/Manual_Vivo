<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api, errorMessages, type ApiError } from '@/api/http';
import type { ProcessEdit, ProcessForm, RecordStatus, UserOption } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import LoadingState from '@/components/LoadingState.vue';
import RequestState from '@/components/RequestState.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { fullName, ROLE_LABELS } from '@/utils/format';

const props = defineProps<{ id?: number }>();
const router = useRouter();
const session = useSessionStore();
const catalog = useCatalogStore();
const toast = useToastStore();

const CODE_RULE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

const form = reactive<ProcessForm>({
  code: '',
  name: '',
  objective: '',
  scope: '',
  areaId: 0,
  ownerId: '',
  accessLevelId: 0,
  isCrossArea: false,
  visibleAreaIds: [],
});
const fieldErrors = reactive<Record<string, string>>({});
const apiErrors = ref<string[]>([]);
const loadError = ref<ApiError | null>(null);
const loading = ref(true);
const saving = ref(false);
const status = ref<RecordStatus>('ACTIVE');
const owners = ref<UserOption[]>([]);

const isEdit = computed(() => props.id !== undefined);
const isAdmin = computed(() => session.isAdmin);
const areaOptions = computed(() =>
  catalog.areas.filter((area) => (area.isActive || area.id === form.areaId) && (isAdmin.value || area.id === session.user?.area.id)),
);
// Un editor no puede asignar un nivel superior al suyo, igual que valida la API
const levelOptions = computed(() =>
  catalog.levels.filter((level) => isAdmin.value || level.level <= (session.user?.accessLevel.level ?? 0)),
);
const extraAreas = computed(() => catalog.areas.filter((area) => area.isActive && area.id !== form.areaId));

async function loadOwners(): Promise<void> {
  if (!form.areaId) {
    owners.value = [];
    return;
  }
  owners.value = await api.get<UserOption[]>(`/users/options?areaId=${form.areaId}`);
  if (form.ownerId && !owners.value.some((owner) => owner.id === form.ownerId)) {
    form.ownerId = '';
  }
}

onMounted(async () => {
  try {
    await catalog.load();
    if (props.id !== undefined) {
      const process = await api.get<ProcessEdit>(`/processes/${props.id}/edit`);
      status.value = process.status;
      Object.assign(form, {
        code: process.code,
        name: process.name,
        objective: process.objective,
        scope: process.scope ?? '',
        areaId: process.areaId,
        ownerId: process.ownerId,
        accessLevelId: process.accessLevelId,
        isCrossArea: process.isCrossArea,
        visibleAreaIds: process.visibleAreaIds,
      });
    } else {
      form.areaId = isAdmin.value ? 0 : (session.user?.area.id ?? 0);
      form.accessLevelId = levelOptions.value[0]?.id ?? 0;
      form.ownerId = isAdmin.value ? '' : (session.user?.id ?? '');
    }
    await loadOwners();
  } catch (error) {
    loadError.value = error as ApiError;
  } finally {
    loading.value = false;
  }
});

watch(
  () => form.areaId,
  (areaId, previous) => {
    if (!loading.value && areaId !== previous) {
      form.visibleAreaIds = form.visibleAreaIds.filter((id) => id !== areaId);
      void loadOwners().catch((error) => (apiErrors.value = errorMessages(error)));
    }
  },
);

function validate(): boolean {
  form.code = form.code.trim().toUpperCase();
  fieldErrors.code =
    form.code.length < 3 || form.code.length > 15
      ? 'El código debe tener entre 3 y 15 caracteres'
      : CODE_RULE.test(form.code)
        ? ''
        : 'Usa mayúsculas, números y guiones, por ejemplo OPE-P02';
  fieldErrors.name = form.name.trim().length >= 3 && form.name.trim().length <= 120 ? '' : 'El nombre debe tener entre 3 y 120 caracteres';
  fieldErrors.objective =
    form.objective.trim().length >= 3 && form.objective.trim().length <= 2000 ? '' : 'El objetivo debe tener entre 3 y 2.000 caracteres';
  fieldErrors.scope = (form.scope ?? '').length <= 2000 ? '' : 'El alcance admite hasta 2.000 caracteres';
  fieldErrors.areaId = form.areaId ? '' : 'Selecciona el área dueña';
  fieldErrors.ownerId = form.ownerId ? '' : 'Selecciona el responsable';
  fieldErrors.accessLevelId = form.accessLevelId ? '' : 'Selecciona el nivel de acceso';
  return Object.values(fieldErrors).every((message) => !message);
}

async function submit(): Promise<void> {
  apiErrors.value = [];
  if (!validate()) {
    return;
  }
  saving.value = true;
  const payload: ProcessForm = {
    ...form,
    name: form.name.trim(),
    objective: form.objective.trim(),
    scope: form.scope?.trim() || null,
    visibleAreaIds: form.isCrossArea ? [] : form.visibleAreaIds,
  };
  try {
    if (isEdit.value) {
      await api.put(`/processes/${props.id}`, payload);
      toast.show(`Se guardaron los cambios de ${payload.code}`);
    } else {
      await api.post('/processes', payload);
      toast.show(`Se registró el proceso ${payload.code}`);
    }
    await router.push({ name: 'manage-processes' });
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
    <RouterLink :to="{ name: 'manage-processes' }">Procesos</RouterLink><span aria-hidden="true">›</span>
    <span>{{ isEdit ? form.code || 'Editar' : 'Nuevo proceso' }}</span>
  </nav>
  <div class="page-head">
    <div>
      <h1>{{ isEdit ? 'Editar proceso' : 'Registrar proceso' }}</h1>
      <p class="sub">Los campos marcados con * son obligatorios.</p>
    </div>
    <span v-if="isEdit" class="chip" :class="status === 'ACTIVE' ? 'ok' : 'gr'">{{ status === 'ACTIVE' ? 'Activo' : 'Archivado' }}</span>
  </div>

  <LoadingState v-if="loading" />
  <RequestState v-else-if="loadError" :loading="false" :error="loadError" />
  <form v-else novalidate @submit.prevent="submit">
    <AlertBox tone="da" :messages="apiErrors" style="margin-bottom: 14px" />
    <div class="row">
      <section class="card" style="flex: 1.2" aria-labelledby="general-title">
        <h2 id="general-title">Datos generales</h2>
        <div class="grid2">
          <div class="fld">
            <label for="process-code">Código <span class="req" aria-hidden="true">*</span></label>
            <input
              id="process-code"
              v-model="form.code"
              class="in"
              :class="{ invalid: fieldErrors.code }"
              maxlength="15"
              placeholder="OPE-P02"
              autocomplete="off"
              :aria-invalid="!!fieldErrors.code"
              aria-describedby="process-code-help"
              @blur="form.code = form.code.trim().toUpperCase()"
            />
            <p v-if="fieldErrors.code" class="err">{{ fieldErrors.code }}</p>
            <p v-else id="process-code-help" class="help">Único en la empresa, por ejemplo OPE-P02.</p>
          </div>
          <div class="fld">
            <label for="process-area">Área dueña <span class="req" aria-hidden="true">*</span></label>
            <select
              id="process-area"
              v-model.number="form.areaId"
              class="in"
              :class="{ invalid: fieldErrors.areaId }"
              :disabled="!isAdmin"
              :aria-invalid="!!fieldErrors.areaId"
              aria-describedby="process-area-help"
            >
              <option :value="0" disabled>Selecciona un área</option>
              <option v-for="area in areaOptions" :key="area.id" :value="area.id">{{ area.name }}</option>
            </select>
            <p v-if="fieldErrors.areaId" class="err">{{ fieldErrors.areaId }}</p>
            <p v-else-if="!isAdmin" id="process-area-help" class="help">Como editor solo registras procesos de tu área.</p>
          </div>
        </div>
        <div class="fld">
          <label for="process-name">Nombre del proceso <span class="req" aria-hidden="true">*</span></label>
          <input
            id="process-name"
            v-model="form.name"
            class="in"
            :class="{ invalid: fieldErrors.name }"
            maxlength="120"
            :aria-invalid="!!fieldErrors.name"
          />
          <p v-if="fieldErrors.name" class="err">{{ fieldErrors.name }}</p>
        </div>
        <div class="grid2">
          <div class="fld">
            <label for="process-owner">Responsable <span class="req" aria-hidden="true">*</span></label>
            <select
              id="process-owner"
              v-model="form.ownerId"
              class="in"
              :class="{ invalid: fieldErrors.ownerId }"
              :disabled="!form.areaId"
              :aria-invalid="!!fieldErrors.ownerId"
            >
              <option value="" disabled>{{ form.areaId ? 'Selecciona una persona' : 'Primero elige el área' }}</option>
              <option v-for="owner in owners" :key="owner.id" :value="owner.id">
                {{ fullName(owner) }} · {{ owner.area.id === form.areaId ? owner.area.name : ROLE_LABELS[owner.role.name] }}
              </option>
            </select>
            <p v-if="fieldErrors.ownerId" class="err">{{ fieldErrors.ownerId }}</p>
          </div>
          <div class="fld">
            <label for="process-level">Nivel de acceso <span class="req" aria-hidden="true">*</span></label>
            <select
              id="process-level"
              v-model.number="form.accessLevelId"
              class="in"
              :class="{ invalid: fieldErrors.accessLevelId }"
              :aria-invalid="!!fieldErrors.accessLevelId"
            >
              <option :value="0" disabled>Selecciona un nivel</option>
              <option v-for="level in levelOptions" :key="level.id" :value="level.id">{{ level.level }} · {{ level.name }}</option>
            </select>
            <p v-if="fieldErrors.accessLevelId" class="err">{{ fieldErrors.accessLevelId }}</p>
          </div>
        </div>
        <div class="fld">
          <label for="process-objective">Objetivo <span class="req" aria-hidden="true">*</span></label>
          <textarea
            id="process-objective"
            v-model="form.objective"
            class="in"
            :class="{ invalid: fieldErrors.objective }"
            rows="3"
            maxlength="2000"
            :aria-invalid="!!fieldErrors.objective"
          />
          <p v-if="fieldErrors.objective" class="err">{{ fieldErrors.objective }}</p>
        </div>
        <div class="fld">
          <label for="process-scope">Alcance</label>
          <textarea id="process-scope" v-model="form.scope" class="in" :class="{ invalid: fieldErrors.scope }" rows="2" maxlength="2000" />
          <p v-if="fieldErrors.scope" class="err">{{ fieldErrors.scope }}</p>
          <p v-else class="help">Desde dónde y hasta dónde aplica el proceso.</p>
        </div>
      </section>

      <div class="col" style="flex: 1">
        <section class="card" aria-labelledby="visibility-title">
          <h2 id="visibility-title">Visibilidad</h2>
          <label class="switch" for="process-cross">
            <input id="process-cross" v-model="form.isCrossArea" type="checkbox" />
            <span class="tog" aria-hidden="true" />
            <span>
              <b>Proceso transversal</b>
              <span class="sub" style="display: block; font-weight: 400">Visible para todas las áreas</span>
            </span>
          </label>
          <fieldset style="border: 0; margin-top: 16px" :disabled="form.isCrossArea">
            <legend class="label">Áreas adicionales con acceso</legend>
            <div style="margin-top: 6px">
              <label v-for="area in extraAreas" :key="area.id" class="cb">
                <input v-model="form.visibleAreaIds" type="checkbox" :value="area.id" />
                <span>{{ area.name }}</span>
              </label>
            </div>
            <p class="help">
              {{ form.isCrossArea ? 'Un proceso transversal ya es visible para todas las áreas.' : 'Además del área dueña, estas áreas podrán consultarlo.' }}
            </p>
          </fieldset>
        </section>
        <AlertBox tone="info">
          Una persona ve el proceso si su área tiene acceso y su nivel es mayor o igual que el del proceso.
        </AlertBox>
        <div class="form-foot">
          <RouterLink class="btn sec" :to="{ name: 'manage-processes' }">Cancelar</RouterLink>
          <button class="btn" type="submit" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar proceso' }}</button>
        </div>
      </div>
    </div>
  </form>
</template>
