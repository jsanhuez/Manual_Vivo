import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/http';
import type { AccessLevel, Area, Role } from '@/api/types';

// Áreas, niveles y roles cambian poco, por eso se cargan una vez y se recargan tras editarlos
export const useCatalogStore = defineStore('catalog', () => {
  const areas = ref<Area[]>([]);
  const levels = ref<AccessLevel[]>([]);
  const roles = ref<Role[]>([]);
  const loaded = ref(false);

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) {
      return;
    }
    const [areaList, levelList, roleList] = await Promise.all([
      api.get<Area[]>('/areas'),
      api.get<AccessLevel[]>('/access-levels'),
      api.get<Role[]>('/roles'),
    ]);
    areas.value = areaList;
    levels.value = levelList;
    roles.value = roleList;
    loaded.value = true;
  }

  function reset(): void {
    areas.value = [];
    levels.value = [];
    roles.value = [];
    loaded.value = false;
  }

  return { areas, levels, roles, loaded, load, reset };
});
