<script setup lang="ts">
import { ref } from 'vue';
import { api, errorMessages } from '@/api/http';
import type { MessageResponse } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AuthLayout from '@/components/AuthLayout.vue';

const email = ref('');
const fieldError = ref('');
const errors = ref<string[]>([]);
const done = ref('');
const sending = ref(false);

async function submit(): Promise<void> {
  errors.value = [];
  fieldError.value = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()) ? '' : 'Ingresa un correo válido';
  if (fieldError.value) {
    return;
  }
  sending.value = true;
  try {
    const response = await api.post<MessageResponse>('/auth/forgot-password', { email: email.value.trim().toLowerCase() });
    done.value = response.message;
  } catch (error) {
    errors.value = errorMessages(error);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AuthLayout
    heading="Recupera el acceso a tu cuenta."
    text="Te enviaremos un enlace de un solo uso, válido por 30 minutos, para que definas una nueva contraseña."
  >
    <RouterLink :to="{ name: 'login' }" style="font-size: 13px; display: inline-flex; gap: 6px; align-items: center">
      <AppIcon name="arrow-left" size="sm" />Volver a iniciar sesión
    </RouterLink>
    <h1 style="margin-top: 14px">Recuperar contraseña</h1>
    <p class="sub" style="margin-bottom: 22px">Ingresa el correo asociado a tu cuenta.</p>

    <AlertBox tone="da" :messages="errors" />

    <form novalidate @submit.prevent="submit">
      <div class="fld">
        <label for="forgot-email">Correo electrónico</label>
        <input
          id="forgot-email"
          v-model="email"
          class="in"
          :class="{ invalid: fieldError }"
          type="email"
          autocomplete="email"
          maxlength="120"
          :aria-invalid="!!fieldError"
          aria-describedby="forgot-email-err"
        />
        <p v-if="fieldError" id="forgot-email-err" class="err">{{ fieldError }}</p>
      </div>
      <button class="btn block" type="submit" :disabled="sending">
        <AppIcon name="mail" />{{ sending ? 'Enviando…' : 'Enviar enlace' }}
      </button>
    </form>

    <AlertBox v-if="done" tone="info" style="margin-top: 18px">
      {{ done }}. Revisa también la carpeta de spam.
    </AlertBox>
  </AuthLayout>
</template>
