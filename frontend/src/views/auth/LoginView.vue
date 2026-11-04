<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { errorMessages } from '@/api/http';
import AlertBox from '@/components/AlertBox.vue';
import AppIcon from '@/components/AppIcon.vue';
import AuthLayout from '@/components/AuthLayout.vue';
import { useSessionStore } from '@/stores/session';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const form = reactive({ email: '', password: '' });
const fieldErrors = reactive({ email: '', password: '' });
const errors = ref<string[]>([]);
const sending = ref(false);
const expired = computed(() => route.query.expired === '1');

function validate(): boolean {
  fieldErrors.email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()) ? '' : 'Ingresa un correo válido';
  fieldErrors.password = form.password ? '' : 'Ingresa tu contraseña';
  return !fieldErrors.email && !fieldErrors.password;
}

async function submit(): Promise<void> {
  errors.value = [];
  if (!validate()) {
    return;
  }
  sending.value = true;
  try {
    await session.login(form.email.trim().toLowerCase(), form.password);
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (error) {
    errors.value = errorMessages(error);
    form.password = '';
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AuthLayout
    heading="Todo lo que necesitas para trabajar en Recylink, en un solo lugar."
    text="Consulta la versión vigente de los procesos y procedimientos que corresponden a tu área y rol."
    features
  >
    <h1>Iniciar sesión</h1>
    <p class="sub" style="margin-bottom: 22px">Ingresa con tu correo corporativo.</p>

    <AlertBox v-if="expired && !errors.length" tone="wa" messages="Tu sesión expiró. Ingresa nuevamente." />
    <AlertBox tone="da" :messages="errors" />

    <form novalidate @submit.prevent="submit">
      <div class="fld">
        <label for="login-email">Correo electrónico</label>
        <input
          id="login-email"
          v-model="form.email"
          class="in"
          :class="{ invalid: fieldErrors.email }"
          type="email"
          autocomplete="username"
          maxlength="120"
          :aria-invalid="!!fieldErrors.email"
          aria-describedby="login-email-err"
        />
        <p v-if="fieldErrors.email" id="login-email-err" class="err">{{ fieldErrors.email }}</p>
      </div>
      <div class="fld">
        <label for="login-password">Contraseña</label>
        <input
          id="login-password"
          v-model="form.password"
          class="in"
          :class="{ invalid: fieldErrors.password }"
          type="password"
          autocomplete="current-password"
          maxlength="72"
          :aria-invalid="!!fieldErrors.password"
          aria-describedby="login-password-err"
        />
        <p v-if="fieldErrors.password" id="login-password-err" class="err">{{ fieldErrors.password }}</p>
      </div>
      <div style="display: flex; justify-content: flex-end; margin: 4px 0 20px">
        <RouterLink :to="{ name: 'forgot-password' }" style="font-size: 13px; font-weight: 600">¿Olvidaste tu contraseña?</RouterLink>
      </div>
      <button class="btn block" type="submit" :disabled="sending">
        {{ sending ? 'Ingresando…' : 'Ingresar' }} <AppIcon name="arrow-right" />
      </button>
    </form>
    <p class="help" style="margin-top: 16px; text-align: center">Tras 5 intentos fallidos el acceso se bloquea por 15 minutos.</p>
  </AuthLayout>
</template>
