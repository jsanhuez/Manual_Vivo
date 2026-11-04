import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api/http';
import type { LoginResponse, Profile, RoleName } from '@/api/types';

const STORAGE_KEY = 'mv.session';

interface StoredSession {
  token: string;
  expiresAt: number;
  user: Profile;
}

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw) as StoredSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function writeStored(session: StoredSession | null): void {
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Sin almacenamiento disponible la sesión dura solo mientras la pestaña esté abierta
  }
}

export const useSessionStore = defineStore('session', () => {
  const session = ref<StoredSession | null>(readStored());

  const token = computed(() => session.value?.token ?? null);
  const user = computed(() => session.value?.user ?? null);
  const isAuthenticated = computed(() => session.value !== null);
  const role = computed<RoleName | null>(() => user.value?.role.name ?? null);
  const canManage = computed(() => role.value === 'EDITOR' || role.value === 'ADMIN');
  const isAdmin = computed(() => role.value === 'ADMIN');

  function clear(): void {
    session.value = null;
    writeStored(null);
  }

  // Date.now no es reactivo, por eso el vencimiento se revisa al navegar y no en un computed
  function ensureValid(): boolean {
    if (session.value && session.value.expiresAt <= Date.now()) {
      clear();
    }
    return session.value !== null;
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await api.post<LoginResponse>('/auth/login', { email, password });
    session.value = {
      token: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      user: response.user,
    };
    writeStored(session.value);
  }

  async function logout(): Promise<void> {
    if (session.value) {
      await api.post('/auth/logout').catch(() => undefined);
    }
    clear();
  }

  function setUser(profile: Profile): void {
    if (session.value) {
      session.value = { ...session.value, user: profile };
      writeStored(session.value);
    }
  }

  async function refreshProfile(): Promise<void> {
    if (session.value) {
      setUser(await api.get<Profile>('/users/me'));
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    role,
    canManage,
    isAdmin,
    ensureValid,
    login,
    logout,
    clear,
    setUser,
    refreshProfile,
  };
});
