<script setup lang="ts">
import { computed } from 'vue';
import { ICONS, type IconName } from './icons';

const props = defineProps<{ name: IconName; size?: 'sm' | 'lg'; label?: string }>();

const markup = computed(() => ICONS[props.name]);
</script>

<template>
  <svg
    class="i"
    :class="size"
    viewBox="0 0 24 24"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
    focusable="false"
    v-html="markup"
  />
</template>
