<script setup lang="ts">
import type { VersionStatus } from '@/api/types';
import { VERSION_STATUS } from '@/utils/format';

defineProps<{ status: VersionStatus; number?: number }>();
</script>

<template>
  <span class="chip" :class="VERSION_STATUS[status].chip">
    {{ VERSION_STATUS[status].label }}<template v-if="number"> · v{{ number }}</template>
  </span>
</template>
