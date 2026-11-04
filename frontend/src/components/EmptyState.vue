<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

withDefaults(defineProps<{ icon?: IconName; title: string; text?: string }>(), { icon: 'info', text: '' });
</script>

<template>
  <div class="empty">
    <AppIcon :name="icon" />
    <h2>{{ title }}</h2>
    <p v-if="text" class="sub">{{ text }}</p>
    <div v-if="$slots.default" class="actions" style="justify-content: center; margin-top: 14px">
      <slot />
    </div>
  </div>
</template>
