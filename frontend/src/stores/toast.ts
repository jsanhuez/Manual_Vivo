import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
  const message = ref<string | null>(null);
  const tone = ref<'ok' | 'da' | 'info'>('ok');
  let timer: number | undefined;

  function show(text: string, kind: 'ok' | 'da' | 'info' = 'ok'): void {
    message.value = text;
    tone.value = kind;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => (message.value = null), 4500);
  }

  function hide(): void {
    message.value = null;
  }

  return { message, tone, show, hide };
});
