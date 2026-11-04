<script setup lang="ts">
import { computed } from 'vue';
import { PASSWORD_HELP, passwordStrength } from '@/utils/password';

const props = defineProps<{ password: string; describedBy: string }>();

const strength = computed(() => passwordStrength(props.password));
</script>

<template>
  <div>
    <div v-if="password" class="bar" :class="strength.tone" style="margin-top: 8px" aria-hidden="true">
      <i :style="{ width: `${strength.score * 20}%` }" />
    </div>
    <p :id="describedBy" class="help">
      <template v-if="password">Seguridad: {{ strength.label }}. </template>{{ PASSWORD_HELP }}
    </p>
  </div>
</template>
