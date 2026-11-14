<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, errorMessages, type ApiError } from '@/api/http';
import type { RouteDetail, RouteProcedureOption, UserOption } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import LoadingState from '@/components/LoadingState.vue';
import RequestState from '@/components/RequestState.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { formatDateOnly, formatPct, fullName, routeStatus, todayInput } from '@/utils/format';

interface StepRow {
  procedureId: number;
  code: string;
  title: string;
  isRequired: boolean;
}

const props = defineProps<{ id?: number }>();
const router = useRouter();
const session = useSessionStore();
const catalog = useCatalogStore();
const toast = useToastStore();

const form = reactive({ name: '', description: '', areaId: null as number | null, isActive: true });
const steps = ref<StepRow[]>([]);
const options = ref<RouteProcedureOption[]>([]);
const toAdd = ref(0);
const detail = ref<RouteDetail | null>(null);
const people = ref<UserOption[]>([]);
const assign = reactive({ userId: '', dueDate: '' });
const fieldErrors = reactive<Record<string, string>>({});
const apiErrors = ref<string[]>([]);
const assignErrors = ref<string[]>([]);
const loading = ref(true);
const loadError = ref<ApiError | null>(null);
const saving = ref(false);
const assigning = ref(false);

const isEdit = computed(() => props.id !== undefined);
const available = computed(() => options.value.filter((option) => !steps.value.some((step) => step.procedureId === option.id)));
const areaOptions = computed(() => catalog.areas.filter((area) => area.isActive && (session.isAdmin || area.id === session.user?.area.id)));
// El editor solo asigna rutas a personas de su área
const assignable = computed(() => people.value.filter((person) => session.isAdmin || person.area.id === session.user?.area.id));

async function loadRoute(): Promise<void> {
  const data = await api.get<RouteDetail>(`/routes/${props.id}`);
  detail.value = data;
  Object.assign(form, { name: data.name, description: data.description ?? '', areaId: data.areaId, isActive: data.isActive });
  steps.value = data.steps.map((step) => ({ procedureId: step.procedureId, code: step.code, title: step.title, isRequired: step.isRequired }));
}

onMounted(async () => {
  try {
    await catalog.load();
    const [procedureOptions, users] = await Promise.all([
      api.get<RouteProcedureOption[]>('/routes/procedures'),
      api.get<UserOption[]>('/users/options'),
    ]);
    options.value = procedureOptions;
    people.value = users;
    if (isEdit.value) {
      await loadRoute();
    } else {
      form.areaId = session.isAdmin ? null : (session.user?.area.id ?? null);
    }
  } catch (error) {
    loadError.value = error as ApiError;
  } finally {
    loading.value = false;
  }
});

function addStep(): void {
  const option = options.value.find((item) => item.id === toAdd.value);
  if (option) {
    steps.value.push({ procedureId: option.id, code: option.code, title: option.title, isRequired: true });
    toAdd.value = 0;
  }
}

function move(index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= steps.value.length) {
    return;
  }
  const list = [...steps.value];
  [list[index], list[target]] = [list[target], list[index]];
  steps.value = list;
}

function validate(): boolean {
  fieldErrors.name = form.name.trim().length >= 3 && form.name.trim().length <= 100 ? '' : 'El nombre debe tener entre 3 y 100 caracteres';
  fieldErrors.description = form.description.length <= 300 ? '' : 'La descripción admite hasta 300 caracteres';
  fieldErrors.steps = steps.value.length ? '' : 'Agrega al menos un procedimiento a la ruta';
  return Object.values(fieldErrors).every((message) => !message);
}

async function save(): Promise<void> {
  apiErrors.value = [];
  if (!validate()) {
    return;
  }
  saving.value = true;
  const payload = {
    name: form.name.trim(),
    description: form.description.trim() || null,
    areaId: form.areaId,
    isActive: form.isActive,
    steps: steps.value.map((step) => ({ procedureId: step.procedureId, isRequired: step.isRequired })),
  };
  try {
    if (isEdit.value) {
      await api.put(`/routes/${props.id}`, payload);
      toast.show(`Se guardó la ruta ${payload.name}`);
      await loadRoute();
    } else {
      const created = await api.post<{ id: number }>('/routes', payload);
      toast.show(`Se creó la ruta ${payload.name}. Ahora puedes asignarla`);
      await router.replace({ name: 'route-edit', params: { id: created.id } });
    }
  } catch (error) {
    apiErrors.value = errorMessages(error);
  } finally {
    saving.value = false;
  }
}

async function assignRoute(): Promise<void> {
  assignErrors.value = [];
  if (!assign.userId) {
    assignErrors.value = ['Selecciona a la persona'];
    return;
  }
  assigning.value = true;
  try {
    await api.post(`/routes/${props.id}/assign`, { userId: assign.userId, dueDate: assign.dueDate || null });
    toast.show(`Se asignó la ruta a ${fullName(people.value.find((person) => person.id === assign.userId))}`);
    Object.assign(assign, { userId: '', dueDate: '' });
    await loadRoute();
  } catch (error) {
    assignErrors.value = errorMessages(error);
  } finally {
    assigning.value = false;
  }
}
</script>

<template>
  <nav class="bc" aria-label="Ruta de navegación">
    <span>Gestión de contenidos</span><span aria-hidden="true">›</span>
    <RouterLink :to="{ name: 'manage-routes' }">Rutas de onboarding</RouterLink><span aria-hidden="true">›</span>
    <span>{{ isEdit ? form.name || 'Editar' : 'Nueva ruta' }}</span>
  </nav>
  <div class="page-head">
    <div>
      <h1>{{ isEdit ? 'Editar ruta de onboarding' : 'Nueva ruta de onboarding' }}</h1>
      <p class="sub">El orden de la lista es el orden de lectura. Solo se agregan procedimientos publicados.</p>
    </div>
    <span v-if="isEdit && !loading" class="chip" :class="detail?.isActive ? 'ok' : 'gr'">{{ detail?.isActive ? 'Activa' : 'Inactiva' }}</span>
  </div>

  <LoadingState v-if="loading" />
  <RequestState v-else-if="loadError" :loading="false" :error="loadError" />
  <div v-else class="row">
    <form class="card" style="flex: 1.6" novalidate @submit.prevent="save">
      <AlertBox tone="da" :messages="apiErrors" style="margin-bottom: 12px" />
      <div class="grid2">
        <div class="fld">
          <label for="route-name">Nombre de la ruta <span class="req" aria-hidden="true">*</span></label>
          <input id="route-name" v-model="form.name" class="in" :class="{ invalid: fieldErrors.name }" maxlength="100" :aria-invalid="!!fieldErrors.name" />
          <p v-if="fieldErrors.name" class="err">{{ fieldErrors.name }}</p>
        </div>
        <div class="fld">
          <label for="route-area">Área</label>
          <select id="route-area" v-model="form.areaId" class="in" :disabled="!session.isAdmin">
            <option v-if="session.isAdmin" :value="null">Transversal (todas las áreas)</option>
            <option v-for="area in areaOptions" :key="area.id" :value="area.id">{{ area.name }}</option>
          </select>
          <p v-if="!session.isAdmin" class="help">Como editor gestionas las rutas de tu área.</p>
        </div>
      </div>
      <div class="fld">
        <label for="route-description">Descripción</label>
        <textarea id="route-description" v-model="form.description" class="in" :class="{ invalid: fieldErrors.description }" rows="2" maxlength="300" />
        <p v-if="fieldErrors.description" class="err">{{ fieldErrors.description }}</p>
      </div>
      <label class="switch" for="route-active" style="margin-bottom: 16px">
        <input id="route-active" v-model="form.isActive" type="checkbox" />
        <span class="tog" aria-hidden="true" />
        <b>Ruta activa</b>
      </label>

      <h2 style="margin: 0 0 8px">Pasos de la ruta</h2>
      <div v-if="steps.length" class="tw" style="border: 1px solid var(--bd); border-radius: 10px">
        <table>
          <caption class="sr-only">Pasos de la ruta en orden de lectura</caption>
          <thead>
            <tr>
              <th scope="col">N°</th>
              <th scope="col">Procedimiento</th>
              <th scope="col">Obligatorio</th>
              <th scope="col"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(step, index) in steps" :key="step.procedureId">
              <td><b>{{ index + 1 }}</b></td>
              <td><span class="code">{{ step.code }}</span> {{ step.title }}</td>
              <td>
                <label class="cb" style="margin: 0">
                  <input v-model="step.isRequired" type="checkbox" :aria-label="`Paso ${step.code} obligatorio`" />
                  <span>{{ step.isRequired ? 'Sí' : 'No' }}</span>
                </label>
              </td>
              <td class="act">
                <button type="button" class="ibtn" :disabled="index === 0" :aria-label="`Subir ${step.code}`" title="Subir" @click="move(index, -1)">
                  <AppIcon name="arrow-up" />
                </button>
                <button type="button" class="ibtn" :disabled="index === steps.length - 1" :aria-label="`Bajar ${step.code}`" title="Bajar" @click="move(index, 1)">
                  <AppIcon name="arrow-down" />
                </button>
                <button type="button" class="ibtn da" :aria-label="`Quitar ${step.code}`" title="Quitar" @click="steps.splice(index, 1)">
                  <AppIcon name="trash" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="sub">La ruta aún no tiene pasos.</p>
      <p v-if="fieldErrors.steps" class="err">{{ fieldErrors.steps }}</p>

      <div style="display: flex; gap: 10px; align-items: flex-end; margin: 12px 0 14px; flex-wrap: wrap">
        <div style="flex: 1; min-width: 220px">
          <label for="route-add">Agregar procedimiento publicado</label>
          <select id="route-add" v-model.number="toAdd" class="in">
            <option :value="0" disabled>Selecciona un procedimiento</option>
            <option v-for="option in available" :key="option.id" :value="option.id">{{ option.code }} · {{ option.title }}</option>
          </select>
        </div>
        <button type="button" class="btn sec" :disabled="!toAdd" @click="addStep"><AppIcon name="plus" />Agregar</button>
      </div>
      <div class="form-foot">
        <RouterLink class="btn sec" :to="{ name: 'manage-routes' }">Cancelar</RouterLink>
        <button type="submit" class="btn" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar ruta' }}</button>
      </div>
    </form>

    <div class="col" style="flex: 1">
      <template v-if="isEdit && detail">
        <form class="card" novalidate aria-labelledby="assign-title" @submit.prevent="assignRoute">
          <h2 id="assign-title">Asignar ruta</h2>
          <AlertBox tone="da" :messages="assignErrors" style="margin-bottom: 12px" />
          <div class="fld">
            <label for="assign-user">Persona</label>
            <select id="assign-user" v-model="assign.userId" class="in" :disabled="!detail.isActive">
              <option value="" disabled>Selecciona a la persona</option>
              <option v-for="person in assignable" :key="person.id" :value="person.id">{{ fullName(person) }} · {{ person.area.name }}</option>
            </select>
          </div>
          <div class="fld">
            <label for="assign-due">Fecha límite</label>
            <input id="assign-due" v-model="assign.dueDate" class="in" type="date" :min="todayInput()" aria-describedby="assign-due-help" />
            <p id="assign-due-help" class="help">Si la persona ya tiene la ruta, solo se actualiza la fecha límite.</p>
          </div>
          <button type="submit" class="btn block" :disabled="assigning || !detail.isActive">
            {{ assigning ? 'Asignando…' : 'Asignar y notificar por correo' }}
          </button>
          <p v-if="!detail.isActive" class="help">Activa la ruta para asignarla.</p>
        </form>

        <section class="card" aria-labelledby="assigned-title">
          <h2 id="assigned-title">Personas asignadas</h2>
          <div v-if="detail.assignments.length" class="lst">
            <div v-for="assignment in detail.assignments" :key="assignment.user.id" style="flex-wrap: wrap">
              <div style="flex: 1; min-width: 140px">
                <b>{{ fullName(assignment.user) }}</b>
                <div class="sub">Límite {{ assignment.dueDate ? formatDateOnly(assignment.dueDate) : 'sin fecha' }}</div>
              </div>
              <div style="width: 110px">
                <div class="bar"><i :style="{ width: `${assignment.progress?.pct ?? 0}%` }" /></div>
                <div class="sub">{{ formatPct(assignment.progress?.pct) }}</div>
              </div>
              <span class="chip" :class="routeStatus(assignment.progress, assignment.dueDate).tone">
                {{ routeStatus(assignment.progress, assignment.dueDate).label }}
              </span>
            </div>
          </div>
          <p v-else class="sub">Aún no hay personas asignadas.</p>
        </section>
      </template>
      <AlertBox v-else tone="info">Guarda la ruta para asignarla a las personas de tu área.</AlertBox>
    </div>
  </div>
</template>
