<script setup lang="ts">
import type { ApiError } from '@/api/http';
import AlertBox from './AlertBox.vue';
import EmptyState from './EmptyState.vue';
import LoadingState from './LoadingState.vue';

defineProps<{ loading: boolean; error: ApiError | null }>();
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else-if="error && error.status === 403" class="card">
    <EmptyState icon="lock" title="No tienes acceso a este contenido" :text="error.messages[0]">
      <RouterLink class="btn sec" :to="{ name: 'knowledge' }">Ir a la base de conocimiento</RouterLink>
    </EmptyState>
  </div>
  <div v-else-if="error && error.status === 404" class="card">
    <EmptyState icon="search" title="No encontramos lo que buscas" :text="error.messages[0]">
      <RouterLink class="btn sec" :to="{ name: 'home' }">Volver al inicio</RouterLink>
    </EmptyState>
  </div>
  <AlertBox v-else-if="error" tone="da" :messages="error.messages" />
  <slot v-else />
</template>
