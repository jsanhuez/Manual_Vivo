<script setup lang="ts">
withDefaults(defineProps<{ text?: string }>(), { text: 'Cargando…' });
</script>

<template>
  <div class="loading" role="status" aria-live="polite">
    <span class="spinner" aria-hidden="true" />
    <span>{{ text }}</span>
  </div>
</template>
