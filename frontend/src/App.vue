<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { useToastStore } from '@/stores/toast';

const toast = useToastStore();
</script>

<template>
  <RouterView />
  <div aria-live="polite" role="status">
    <div v-if="toast.message" class="alert toast" :class="toast.tone">
      <AppIcon :name="toast.tone === 'da' ? 'alert' : 'check-circle'" />
      <div style="flex: 1">{{ toast.message }}</div>
      <button type="button" class="ibtn" aria-label="Cerrar aviso" @click="toast.hide()">
        <AppIcon name="x" size="sm" />
      </button>
    </div>
  </div>
</template>
