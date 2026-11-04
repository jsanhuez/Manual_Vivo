<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue';
</script>

<template>
  <div class="card">
    <EmptyState icon="lock" title="No tienes permisos para ver esta sección" text="Si crees que es un error, solicita acceso al administrador de la plataforma.">
      <RouterLink class="btn sec" :to="{ name: 'home' }">Volver al inicio</RouterLink>
    </EmptyState>
  </div>
</template>
