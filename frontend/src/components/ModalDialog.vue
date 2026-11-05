<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ open: boolean; title: string; description?: string }>();
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLElement | null>(null);
let previousFocus: HTMLElement | null = null;

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close');
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', onKeydown);
      await nextTick();
      // El foco pasa al primer campo para que el formulario se pueda completar con teclado
      dialog.value?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    } else {
      document.removeEventListener('keydown', onKeydown);
      previousFocus?.focus();
    }
  },
);

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @mousedown.self="emit('close')">
      <div ref="dialog" class="modal" role="dialog" aria-modal="true" :aria-label="title">
        <div class="modal-head">
          <h2>{{ title }}</h2>
          <button type="button" class="ibtn" aria-label="Cerrar" @click="emit('close')">
            <AppIcon name="x" />
          </button>
        </div>
        <p v-if="description" class="sub" style="margin: 4px 0 14px">{{ description }}</p>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
