<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
</script>

<template>
  <div class="card">
    <EmptyState icon="search" title="No encontramos esta página" text="Revisa la dirección o vuelve a la base de conocimiento.">
      <RouterLink class="btn" :to="{ name: 'knowledge' }">Ir a la base de conocimiento</RouterLink>
      <RouterLink class="btn sec" :to="{ name: 'home' }">Volver al inicio</RouterLink>
    </EmptyState>
  </div>
</template>
