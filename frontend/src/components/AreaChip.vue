<script setup lang="ts">
import { areaClass } from '@/utils/format';

defineProps<{ name: string }>();
</script>

<template>
  <span class="chip" :class="areaClass(name)">{{ name }}</span>
</template>
