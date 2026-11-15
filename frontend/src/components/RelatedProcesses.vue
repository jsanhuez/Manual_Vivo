<script setup lang="ts">
import { computed } from 'vue';
import type { ProcessRelations } from '@/api/types';
import { RELATION_IN, RELATION_OUT } from '@/utils/format';
import AreaChip from './AreaChip.vue';

const props = defineProps<{ relations: ProcessRelations }>();

const items = computed(() => [
  ...props.relations.outgoing.map((relation) => ({ ...relation, key: `o${relation.id}`, label: RELATION_OUT[relation.relationType] })),
  ...props.relations.incoming.map((relation) => ({ ...relation, key: `i${relation.id}`, label: RELATION_IN[relation.relationType] })),
]);
</script>

<template>
  <div v-if="items.length" class="lst">
    <div v-for="item in items" :key="item.key" style="align-items: flex-start">
      <div style="flex: 1; min-width: 0">
        <div class="sub">{{ item.label }}</div>
        <RouterLink :to="{ name: 'process', params: { id: item.process.id } }">
          <span class="code">{{ item.process.code }}</span> {{ item.process.name }}
        </RouterLink>
        <div v-if="item.description" class="sub">{{ item.description }}</div>
      </div>
      <AreaChip :name="item.process.area.name" />
    </div>
  </div>
  <p v-else class="sub">No hay procesos relacionados que puedas consultar.</p>
</template>
