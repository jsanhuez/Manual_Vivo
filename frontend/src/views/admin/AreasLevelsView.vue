<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api, errorMessages, type ApiError } from '@/api/http';
import type { AccessLevel, Area } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AreaChip from '@/components/AreaChip.vue';
import ModalDialog from '@/components/ModalDialog.vue';
import RequestState from '@/components/RequestState.vue';
import { useCatalogStore } from '@/stores/catalog';
import { useToastStore } from '@/stores/toast';
import { plural } from '@/utils/format';

const catalog = useCatalogStore();
const toast = useToastStore();

const loading = ref(true);
const loadError = ref<ApiError | null>(null);

const areaForm = reactive({ id: 0, name: '', description: '', isActive: true });
const areaErrors = reactive({ name: '', description: '' });
const areaApiErrors = ref<string[]>([]);
const areaEditing = ref(false);
const savingArea = ref(false);

const levelForm = reactive({ id: 0, name: '', level: 1, description: '' });
const levelErrors = reactive({ name: '', level: '', description: '' });
const levelApiErrors = ref<string[]>([]);
const levelEditing = ref(false);
const savingLevel = ref(false);

const deleting = ref<AccessLevel | null>(null);
const deleteErrors = ref<string[]>([]);

const selectedArea = computed(() => catalog.areas.find((area) => area.id === areaForm.id) ?? null);

async function reload(): Promise<void> {
  try {
    await catalog.load(true);
  } catch (error) {
    loadError.value = error as ApiError;
  } finally {
    loading.value = false;
  }
}

onMounted(reload);

function editArea(area: Area | null): void {
  Object.assign(areaForm, area ? { id: area.id, name: area.name, description: area.description ?? '', isActive: area.isActive } : { id: 0, name: '', description: '', isActive: true });
  areaErrors.name = '';
  areaErrors.description = '';
  areaApiErrors.value = [];
  areaEditing.value = true;
}

function editLevel(level: AccessLevel | null): void {
  const next = Math.max(0, ...catalog.levels.map((item) => item.level)) + 1;
  Object.assign(levelForm, level ? { id: level.id, name: level.name, level: level.level, description: level.description ?? '' } : { id: 0, name: '', level: Math.min(next, 9), description: '' });
  levelErrors.name = '';
  levelErrors.level = '';
  levelErrors.description = '';
  levelApiErrors.value = [];
  levelEditing.value = true;
}

async function saveArea(): Promise<void> {
  areaApiErrors.value = [];
  const name = areaForm.name.trim();
  areaErrors.name = name.length >= 2 && name.length <= 60 ? '' : 'El nombre debe tener entre 2 y 60 caracteres';
  areaErrors.description = areaForm.description.trim().length <= 200 ? '' : 'La descripción admite hasta 200 caracteres';
  if (areaErrors.name || areaErrors.description) {
    return;
  }
  savingArea.value = true;
  const payload = { name, description: areaForm.description.trim() || null, isActive: areaForm.isActive };
  try {
    if (areaForm.id) {
      await api.put(`/areas/${areaForm.id}`, payload);
      toast.show(`Se actualizó el área ${name}`);
    } else {
      await api.post('/areas', payload);
      toast.show(`Se creó el área ${name}`);
    }
    areaEditing.value = false;
    await reload();
  } catch (error) {
    areaApiErrors.value = errorMessages(error);
  } finally {
    savingArea.value = false;
  }
}

async function saveLevel(): Promise<void> {
  levelApiErrors.value = [];
  const name = levelForm.name.trim();
  levelErrors.name = name.length >= 2 && name.length <= 40 ? '' : 'El nombre debe tener entre 2 y 40 caracteres';
  levelErrors.level = Number.isInteger(levelForm.level) && levelForm.level >= 1 && levelForm.level <= 9 ? '' : 'El valor debe estar entre 1 y 9';
  levelErrors.description = levelForm.description.trim().length <= 150 ? '' : 'La descripción admite hasta 150 caracteres';
  if (levelErrors.name || levelErrors.level || levelErrors.description) {
    return;
  }
  savingLevel.value = true;
  const payload = { name, level: levelForm.level, description: levelForm.description.trim() || null };
  try {
    if (levelForm.id) {
      await api.put(`/access-levels/${levelForm.id}`, payload);
      toast.show(`Se actualizó el nivel ${name}`);
    } else {
      await api.post('/access-levels', payload);
      toast.show(`Se creó el nivel ${name}`);
    }
    levelEditing.value = false;
    await reload();
  } catch (error) {
    levelApiErrors.value = errorMessages(error);
  } finally {
    savingLevel.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  if (!deleting.value) {
    return;
  }
  deleteErrors.value = [];
  try {
    await api.delete(`/access-levels/${deleting.value.id}`);
    toast.show(`Se eliminó el nivel ${deleting.value.name}`);
    deleting.value = null;
    await reload();
  } catch (error) {
    deleteErrors.value = errorMessages(error);
  }
}
</script>

<template>
  <div class="page-head">
    <div>
      <nav class="bc" aria-label="Ruta de navegación"><span>Administración</span><span aria-hidden="true">›</span><span>Áreas y niveles</span></nav>
      <h1>Áreas y niveles de acceso</h1>
      <p class="sub">Catálogos que determinan qué procesos y procedimientos puede consultar cada usuario.</p>
    </div>
    <div class="actions">
      <button type="button" class="btn sec" @click="editLevel(null)"><AppIcon name="plus" />Nuevo nivel</button>
      <button type="button" class="btn" @click="editArea(null)"><AppIcon name="plus" />Nueva área</button>
    </div>
  </div>

  <RequestState :loading="loading" :error="loadError">
    <div class="row">
      <div class="col" style="flex: 1.7">
        <section class="card flush" aria-label="Áreas">
          <div class="tw">
            <table>
              <caption class="sr-only">Áreas de la empresa</caption>
              <thead>
                <tr>
                  <th scope="col">Área</th>
                  <th scope="col" class="num">Usuarios activos</th>
                  <th scope="col" class="num">Procesos activos</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="area in catalog.areas" :key="area.id" :class="{ sel: areaEditing && areaForm.id === area.id }">
                  <td>
                    <AreaChip :name="area.name" />
                    <div v-if="area.description" class="sub" style="margin-top: 4px">{{ area.description }}</div>
                  </td>
                  <td class="num">{{ area.activeUsers }}</td>
                  <td class="num">{{ area.activeProcesses }}</td>
                  <td><span class="chip" :class="area.isActive ? 'ok' : 'gr'">{{ area.isActive ? 'Activa' : 'Inactiva' }}</span></td>
                  <td class="act">
                    <button type="button" class="ibtn" :aria-label="`Editar el área ${area.name}`" title="Editar" @click="editArea(area)">
                      <AppIcon name="edit" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card" aria-labelledby="levels-title">
          <div class="card-head">
            <h2 id="levels-title">Niveles de acceso</h2>
            <span class="sub">Un valor mayor otorga más acceso</span>
          </div>
          <div class="lst">
            <div v-for="level in catalog.levels" :key="level.id">
              <span class="lvl" aria-hidden="true">{{ level.level }}</span>
              <div style="flex: 1; min-width: 0">
                <b>{{ level.name }}</b> <span class="sr-only">valor {{ level.level }}</span>
                <div class="sub" style="font-size: 12.5px">{{ level.description }}</div>
              </div>
              <span class="sub nowrap hide-m">{{ plural(level.users, 'usuario', 'usuarios') }} · {{ plural(level.contents, 'contenido', 'contenidos') }}</span>
              <button type="button" class="ibtn" :aria-label="`Editar el nivel ${level.name}`" title="Editar" @click="editLevel(level)">
                <AppIcon name="edit" />
              </button>
              <button
                type="button"
                class="ibtn da"
                :aria-label="`Eliminar el nivel ${level.name}`"
                title="Eliminar"
                @click="
                  deleting = level;
                  deleteErrors = [];
                "
              >
                <AppIcon name="trash" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <div class="col" style="flex: 1">
        <form v-if="areaEditing" class="card" novalidate aria-labelledby="area-form-title" @submit.prevent="saveArea">
          <h2 id="area-form-title">{{ areaForm.id ? 'Editar área' : 'Nueva área' }}</h2>
          <AlertBox tone="da" :messages="areaApiErrors" style="margin-bottom: 12px" />
          <div class="fld">
            <label for="area-name">Nombre <span class="req" aria-hidden="true">*</span></label>
            <input id="area-name" v-model="areaForm.name" class="in" :class="{ invalid: areaErrors.name }" maxlength="60" />
            <p v-if="areaErrors.name" class="err">{{ areaErrors.name }}</p>
          </div>
          <div class="fld">
            <label for="area-description">Descripción</label>
            <textarea id="area-description" v-model="areaForm.description" class="in" :class="{ invalid: areaErrors.description }" rows="2" maxlength="200" />
            <p v-if="areaErrors.description" class="err">{{ areaErrors.description }}</p>
          </div>
          <label class="switch" for="area-active" style="margin-bottom: 6px">
            <input id="area-active" v-model="areaForm.isActive" type="checkbox" aria-describedby="area-active-help" />
            <span class="tog" aria-hidden="true" />
            <span>
              <b>Área activa</b>
              <span class="sub" style="display: block; font-weight: 400">Disponible para usuarios y procesos</span>
            </span>
          </label>
          <p id="area-active-help" class="help" style="margin-bottom: 14px">
            <template v-if="selectedArea?.activeUsers">
              No se puede desactivar mientras tenga usuarios activos ({{ selectedArea.activeUsers }}).
            </template>
            <template v-else>Desactivar un área no elimina sus datos.</template>
          </p>
          <div class="form-foot">
            <button type="button" class="btn sec" @click="areaEditing = false">Cancelar</button>
            <button type="submit" class="btn" :disabled="savingArea">{{ savingArea ? 'Guardando…' : 'Guardar cambios' }}</button>
          </div>
        </form>

        <form v-if="levelEditing" class="card" novalidate aria-labelledby="level-form-title" @submit.prevent="saveLevel">
          <h2 id="level-form-title">{{ levelForm.id ? 'Editar nivel' : 'Nuevo nivel' }}</h2>
          <AlertBox tone="da" :messages="levelApiErrors" style="margin-bottom: 12px" />
          <div class="grid2" style="grid-template-columns: 2fr 1fr">
            <div class="fld">
              <label for="level-name">Nombre <span class="req" aria-hidden="true">*</span></label>
              <input id="level-name" v-model="levelForm.name" class="in" :class="{ invalid: levelErrors.name }" maxlength="40" />
              <p v-if="levelErrors.name" class="err">{{ levelErrors.name }}</p>
            </div>
            <div class="fld">
              <label for="level-value">Valor <span class="req" aria-hidden="true">*</span></label>
              <input id="level-value" v-model.number="levelForm.level" class="in" :class="{ invalid: levelErrors.level }" type="number" min="1" max="9" />
              <p v-if="levelErrors.level" class="err">{{ levelErrors.level }}</p>
            </div>
          </div>
          <div class="fld">
            <label for="level-description">Criterio de uso</label>
            <textarea id="level-description" v-model="levelForm.description" class="in" :class="{ invalid: levelErrors.description }" rows="2" maxlength="150" />
            <p v-if="levelErrors.description" class="err">{{ levelErrors.description }}</p>
          </div>
          <div class="form-foot">
            <button type="button" class="btn sec" @click="levelEditing = false">Cancelar</button>
            <button type="submit" class="btn" :disabled="savingLevel">{{ savingLevel ? 'Guardando…' : 'Guardar nivel' }}</button>
          </div>
        </form>

        <AlertBox tone="info">
          Un usuario ve un contenido solo si su área está habilitada y su nivel es mayor o igual que el del proceso y el del procedimiento.
        </AlertBox>
      </div>
    </div>
  </RequestState>

  <ModalDialog :open="deleting !== null" title="Eliminar nivel de acceso" @close="deleting = null">
    <AlertBox tone="da" :messages="deleteErrors" style="margin-bottom: 12px" />
    <p>¿Eliminar el nivel <b>{{ deleting?.name }}</b>? Solo es posible si ningún usuario, proceso o procedimiento lo usa.</p>
    <div class="form-foot" style="margin-top: 16px">
      <button type="button" class="btn sec" @click="deleting = null">Cancelar</button>
      <button type="button" class="btn da" @click="confirmDelete">Eliminar</button>
    </div>
  </ModalDialog>
</template>
