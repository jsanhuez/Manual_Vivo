<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = withDefaults(defineProps<{ tone?: 'wa' | 'info' | 'ok' | 'da'; messages?: string | string[] | null }>(), {
  tone: 'info',
  messages: null,
});

const list = computed(() => (props.messages === null ? [] : Array.isArray(props.messages) ? props.messages : [props.messages]));
const icon = computed(() => (props.tone === 'ok' ? 'check-circle' : props.tone === 'info' ? 'info' : 'alert'));
</script>

<template>
  <div
    v-if="list.length || $slots.default"
    class="alert"
    :class="tone === 'wa' ? '' : tone"
    :role="tone === 'da' ? 'alert' : 'status'"
  >
    <AppIcon :name="icon" />
    <div>
      <slot />
      <p v-if="list.length === 1">{{ list[0] }}</p>
      <ul v-else-if="list.length > 1">
        <li v-for="message in list" :key="message">{{ message }}</li>
      </ul>
    </div>
  </div>
</template>
