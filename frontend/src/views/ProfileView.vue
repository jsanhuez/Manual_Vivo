<script setup lang="ts">
import { reactive, ref } from 'vue';
import { api, errorMessages } from '@/api/http';
import type { Profile } from '@/api/types';
import AlertBox from '@/components/AlertBox.vue';
import PasswordStrength from '@/components/PasswordStrength.vue';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toast';
import { formatDateOnly, fullName, initials, ROLE_LABELS } from '@/utils/format';
import { PASSWORD_RULE } from '@/utils/password';

const session = useSessionStore();
const toast = useToastStore();

const profile = reactive({
  firstName: session.user?.firstName ?? '',
  lastName: session.user?.lastName ?? '',
  jobTitle: session.user?.jobTitle ?? '',
});
const profileErrors = reactive({ firstName: '', lastName: '', jobTitle: '' });
const profileApiErrors = ref<string[]>([]);
const savingProfile = ref(false);

const passwords = reactive({ current: '', next: '', confirm: '' });
const passwordErrors = reactive({ current: '', next: '', confirm: '' });
const passwordApiErrors = ref<string[]>([]);
const savingPassword = ref(false);

async function saveProfile(): Promise<void> {
  profileApiErrors.value = [];
  profileErrors.firstName = profile.firstName.trim() && profile.firstName.trim().length <= 60 ? '' : 'Ingresa un nombre de hasta 60 caracteres';
  profileErrors.lastName = profile.lastName.trim() && profile.lastName.trim().length <= 60 ? '' : 'Ingresa un apellido de hasta 60 caracteres';
  profileErrors.jobTitle = profile.jobTitle.trim().length <= 80 ? '' : 'El cargo admite hasta 80 caracteres';
  if (profileErrors.firstName || profileErrors.lastName || profileErrors.jobTitle) {
    return;
  }
  savingProfile.value = true;
  try {
    const updated = await api.patch<Profile>('/users/me', {
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      jobTitle: profile.jobTitle.trim() || null,
    });
    session.setUser(updated);
    toast.show('Tus datos se actualizaron');
  } catch (error) {
    profileApiErrors.value = errorMessages(error);
  } finally {
    savingProfile.value = false;
  }
}

async function savePassword(): Promise<void> {
  passwordApiErrors.value = [];
  passwordErrors.current = passwords.current ? '' : 'Ingresa tu contraseña actual';
  passwordErrors.next = PASSWORD_RULE.test(passwords.next) ? '' : 'La nueva contraseña no cumple los requisitos';
  passwordErrors.confirm = passwords.confirm === passwords.next ? '' : 'Las contraseñas no coinciden';
  if (passwordErrors.current || passwordErrors.next || passwordErrors.confirm) {
    return;
  }
  savingPassword.value = true;
  try {
    await api.patch('/users/me/password', { currentPassword: passwords.current, newPassword: passwords.next });
    passwords.current = '';
    passwords.next = '';
    passwords.confirm = '';
    toast.show('Tu contraseña se actualizó');
  } catch (error) {
    passwordApiErrors.value = errorMessages(error);
  } finally {
    savingPassword.value = false;
  }
}
</script>

<template>
  <h1>Mi perfil</h1>
  <p class="sub">Revisa tus datos y administra tu contraseña.</p>

  <div v-if="session.user" class="row mt">
    <form class="card" style="flex: 1.2" novalidate aria-labelledby="profile-title" @submit.prevent="saveProfile">
      <h2 id="profile-title">Datos personales</h2>
      <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 16px">
        <div class="av lg" style="background: #0b6a73" aria-hidden="true">{{ initials(session.user) }}</div>
        <div>
          <b>{{ fullName(session.user) }}</b>
          <div class="sub">{{ session.user.email }}</div>
        </div>
      </div>
      <AlertBox tone="da" :messages="profileApiErrors" style="margin-bottom: 14px" />
      <div class="grid2">
        <div class="fld">
          <label for="profile-first">Nombre <span class="req" aria-hidden="true">*</span></label>
          <input
            id="profile-first"
            v-model="profile.firstName"
            class="in"
            :class="{ invalid: profileErrors.firstName }"
            maxlength="60"
            autocomplete="given-name"
            required
            :aria-invalid="!!profileErrors.firstName"
          />
          <p v-if="profileErrors.firstName" class="err">{{ profileErrors.firstName }}</p>
        </div>
        <div class="fld">
          <label for="profile-last">Apellido <span class="req" aria-hidden="true">*</span></label>
          <input
            id="profile-last"
            v-model="profile.lastName"
            class="in"
            :class="{ invalid: profileErrors.lastName }"
            maxlength="60"
            autocomplete="family-name"
            required
            :aria-invalid="!!profileErrors.lastName"
          />
          <p v-if="profileErrors.lastName" class="err">{{ profileErrors.lastName }}</p>
        </div>
      </div>
      <div class="grid2">
        <div class="fld">
          <label for="profile-job">Cargo</label>
          <input
            id="profile-job"
            v-model="profile.jobTitle"
            class="in"
            :class="{ invalid: profileErrors.jobTitle }"
            maxlength="80"
            autocomplete="organization-title"
          />
          <p v-if="profileErrors.jobTitle" class="err">{{ profileErrors.jobTitle }}</p>
        </div>
        <div class="fld">
          <label for="profile-area">Área</label>
          <input id="profile-area" class="in" :value="session.user.area.name" readonly aria-describedby="profile-area-help" />
        </div>
      </div>
      <div class="grid2">
        <div class="fld">
          <label for="profile-role">Rol y nivel de acceso</label>
          <input
            id="profile-role"
            class="in"
            :value="`${ROLE_LABELS[session.user.role.name]} · ${session.user.accessLevel.name}`"
            readonly
            aria-describedby="profile-area-help"
          />
        </div>
        <div class="fld">
          <label for="profile-hire">Fecha de ingreso</label>
          <input id="profile-hire" class="in" :value="formatDateOnly(session.user.hireDate)" readonly />
        </div>
      </div>
      <p id="profile-area-help" class="help" style="margin: -4px 0 14px">Solo un administrador puede cambiar tu área, rol o nivel.</p>
      <div class="form-foot">
        <button class="btn" type="submit" :disabled="savingProfile">{{ savingProfile ? 'Guardando…' : 'Guardar cambios' }}</button>
      </div>
    </form>

    <form class="card" style="flex: 1" novalidate aria-labelledby="password-title" @submit.prevent="savePassword">
      <h2 id="password-title">Cambiar contraseña</h2>
      <AlertBox tone="da" :messages="passwordApiErrors" style="margin-bottom: 14px" />
      <div class="fld">
        <label for="password-current">Contraseña actual</label>
        <input
          id="password-current"
          v-model="passwords.current"
          class="in"
          :class="{ invalid: passwordErrors.current }"
          type="password"
          autocomplete="current-password"
          maxlength="72"
          :aria-invalid="!!passwordErrors.current"
        />
        <p v-if="passwordErrors.current" class="err">{{ passwordErrors.current }}</p>
      </div>
      <div class="fld">
        <label for="password-next">Nueva contraseña</label>
        <input
          id="password-next"
          v-model="passwords.next"
          class="in"
          :class="{ invalid: passwordErrors.next }"
          type="password"
          autocomplete="new-password"
          maxlength="72"
          :aria-invalid="!!passwordErrors.next"
          aria-describedby="password-next-help"
        />
        <p v-if="passwordErrors.next" class="err">{{ passwordErrors.next }}</p>
        <PasswordStrength :password="passwords.next" described-by="password-next-help" />
      </div>
      <div class="fld">
        <label for="password-confirm">Confirmar nueva contraseña</label>
        <input
          id="password-confirm"
          v-model="passwords.confirm"
          class="in"
          :class="{ invalid: passwordErrors.confirm }"
          type="password"
          autocomplete="new-password"
          maxlength="72"
          :aria-invalid="!!passwordErrors.confirm"
        />
        <p v-if="passwordErrors.confirm" class="err">{{ passwordErrors.confirm }}</p>
      </div>
      <button class="btn block" type="submit" :disabled="savingPassword">
        {{ savingPassword ? 'Actualizando…' : 'Actualizar contraseña' }}
      </button>
    </form>
  </div>
</template>
