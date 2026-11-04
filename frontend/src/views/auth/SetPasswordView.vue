<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api, errorMessages } from '@/api/http';
import type { MessageResponse, TokenInfo } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import AuthLayout from '@/components/AuthLayout.vue';
import LoadingState from '@/components/LoadingState.vue';
import PasswordStrength from '@/components/PasswordStrength.vue';
import { PASSWORD_RULE } from '@/utils/password';

const props = defineProps<{ mode: 'reset' | 'invite' }>();

const state = ref<'checking' | 'ready' | 'invalid' | 'done'>('checking');
const info = ref<TokenInfo | null>(null);
const token = ref('');
const form = reactive({ password: '', confirm: '' });
const fieldErrors = reactive({ password: '', confirm: '' });
const errors = ref<string[]>([]);
const result = ref('');
const sending = ref(false);

const isInvite = computed(() => (info.value?.purpose ?? props.mode) === 'invite');

// El token viaja después de # para que no quede en los registros del servidor del frontend
onMounted(async () => {
  token.value = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  if (!token.value) {
    state.value = 'invalid';
    errors.value = ['El enlace está incompleto. Ábrelo nuevamente desde el correo'];
    return;
  }
  try {
    info.value = await api.post<TokenInfo>('/auth/verify-token', { token: token.value });
    state.value = 'ready';
  } catch (error) {
    errors.value = errorMessages(error);
    state.value = 'invalid';
  }
});

async function submit(): Promise<void> {
  errors.value = [];
  fieldErrors.password = PASSWORD_RULE.test(form.password) ? '' : 'La contraseña no cumple los requisitos';
  fieldErrors.confirm = form.confirm === form.password ? '' : 'Las contraseñas no coinciden';
  if (fieldErrors.password || fieldErrors.confirm) {
    return;
  }
  sending.value = true;
  try {
    const response = await api.post<MessageResponse>('/auth/reset-password', { token: token.value, password: form.password });
    result.value = response.message;
    state.value = 'done';
  } catch (error) {
    errors.value = errorMessages(error);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <AuthLayout
    :heading="isInvite ? 'Te damos la bienvenida a Manual Vivo.' : 'Define una nueva contraseña.'"
    :text="
      isInvite
        ? 'Crea tu contraseña para consultar los procesos y procedimientos de tu área.'
        : 'El enlace es de un solo uso y deja de funcionar apenas cambias tu contraseña.'
    "
  >
    <h1>{{ isInvite ? 'Activar cuenta' : 'Nueva contraseña' }}</h1>

    <LoadingState v-if="state === 'checking'" text="Validando el enlace…" />

    <template v-else-if="state === 'invalid'">
      <AlertBox tone="da" :messages="errors" style="margin-top: 16px" />
      <p class="sub" style="margin-bottom: 16px">
        {{
          isInvite
            ? 'Pide al administrador que te reenvíe la invitación o solicita un enlace de recuperación.'
            : 'Puedes solicitar un nuevo enlace de recuperación.'
        }}
      </p>
      <RouterLink class="btn block" :to="{ name: 'forgot-password' }">Solicitar un nuevo enlace</RouterLink>
    </template>

    <template v-else-if="state === 'done'">
      <AlertBox tone="ok" :messages="result" style="margin-top: 16px" />
      <RouterLink class="btn block" :to="{ name: 'login' }">Iniciar sesión</RouterLink>
    </template>

    <template v-else>
      <p class="sub" style="margin-bottom: 22px">
        Hola, {{ info?.firstName }}. Define la contraseña de <b>{{ info?.email }}</b>.
      </p>
      <AlertBox tone="da" :messages="errors" />
      <form novalidate @submit.prevent="submit">
        <div class="fld">
          <label for="new-password">Nueva contraseña</label>
          <input
            id="new-password"
            v-model="form.password"
            class="in"
            :class="{ invalid: fieldErrors.password }"
            type="password"
            autocomplete="new-password"
            maxlength="72"
            :aria-invalid="!!fieldErrors.password"
            aria-describedby="new-password-help"
          />
          <p v-if="fieldErrors.password" class="err">{{ fieldErrors.password }}</p>
          <PasswordStrength :password="form.password" described-by="new-password-help" />
        </div>
        <div class="fld">
          <label for="confirm-password">Confirmar contraseña</label>
          <input
            id="confirm-password"
            v-model="form.confirm"
            class="in"
            :class="{ invalid: fieldErrors.confirm }"
            type="password"
            autocomplete="new-password"
            maxlength="72"
            :aria-invalid="!!fieldErrors.confirm"
            aria-describedby="confirm-password-err"
          />
          <p v-if="fieldErrors.confirm" id="confirm-password-err" class="err">{{ fieldErrors.confirm }}</p>
        </div>
        <button class="btn block" type="submit" :disabled="sending">
          {{ sending ? 'Guardando…' : isInvite ? 'Activar cuenta' : 'Guardar contraseña' }}
        </button>
      </form>
    </template>
  </AuthLayout>
</template>
