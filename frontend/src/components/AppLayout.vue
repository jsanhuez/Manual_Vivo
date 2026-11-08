<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import { useCatalogStore } from '@/stores/catalog';
import { useSessionStore } from '@/stores/session';
import { fullName, initials, ROLE_LABELS } from '@/utils/format';
import AppIcon from './AppIcon.vue';
import type { IconName } from './icons';

interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  to: RouteLocationRaw;
}

const session = useSessionStore();
const catalog = useCatalogStore();
const route = useRoute();
const router = useRouter();

const drawerOpen = ref(false);
const search = ref(typeof route.query.q === 'string' ? route.query.q : '');

const sections = computed(() => {
  const list: { title: string; items: NavItem[] }[] = [
    {
      title: 'Consulta',
      items: [
        { key: 'home', label: 'Inicio', icon: 'home', to: { name: 'home' } },
        { key: 'knowledge', label: 'Base de conocimiento', icon: 'book', to: { name: 'knowledge' } },
        { key: 'search', label: 'Buscar', icon: 'search', to: { name: 'search' } },
      ],
    },
  ];
  if (session.isAdmin) {
    list.push({
      title: 'Administración',
      items: [
        { key: 'users', label: 'Usuarios', icon: 'users', to: { name: 'users' } },
        { key: 'areas', label: 'Áreas y niveles', icon: 'layers', to: { name: 'areas' } },
      ],
    });
  }
  list.push({ title: 'Cuenta', items: [{ key: 'profile', label: 'Mi perfil', icon: 'user', to: { name: 'profile' } }] });
  return list;
});

const bottomItems: NavItem[] = [
  { key: 'home', label: 'Inicio', icon: 'home', to: { name: 'home' } },
  { key: 'knowledge', label: 'Contenidos', icon: 'book', to: { name: 'knowledge' } },
  { key: 'search', label: 'Buscar', icon: 'search', to: { name: 'search' } },
  { key: 'profile', label: 'Perfil', icon: 'user', to: { name: 'profile' } },
];

const active = computed(() => route.meta.nav);
const roleLine = computed(() =>
  session.user ? `${ROLE_LABELS[session.user.role.name]} · ${session.user.area.name}` : '',
);
const avatarColor = computed(() => {
  const colors = { COLLABORATOR: '#0b6a73', EDITOR: '#7b3fb5', ADMIN: '#1d5fa8' };
  return session.user ? colors[session.user.role.name] : '#3b6fb6';
});

watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false;
  },
);

watch(
  () => route.query.q,
  (q) => {
    if (route.name === 'search') {
      search.value = typeof q === 'string' ? q : '';
    }
  },
);

function submitSearch(): void {
  const q = search.value.trim();
  void router.push({ name: 'search', query: q ? { q } : {} });
}

async function logout(): Promise<void> {
  await session.logout();
  catalog.reset();
  await router.push({ name: 'login' });
}
</script>

<template>
  <a class="skip-link" href="#contenido">Saltar al contenido</a>
  <div class="shell" :class="{ 'drawer-open': drawerOpen }">
    <aside id="menu-principal" class="side" aria-label="Menú principal">
      <div class="brand">
        <div class="logo" aria-hidden="true">MV</div>
        <div>Manual Vivo<small>Recylink</small></div>
      </div>
      <nav class="nav">
        <template v-for="section in sections" :key="section.title">
          <div class="nav-t">{{ section.title }}</div>
          <RouterLink
            v-for="item in section.items"
            :key="item.key"
            :to="item.to"
            :class="{ on: active === item.key }"
            :aria-current="active === item.key ? 'page' : undefined"
          >
            <AppIcon :name="item.icon" />{{ item.label }}
          </RouterLink>
        </template>
        <button type="button" @click="logout"><AppIcon name="logout" />Cerrar sesión</button>
      </nav>
      <div class="foot">Manual Vivo v0.4</div>
    </aside>
    <div class="backdrop" aria-hidden="true" @click="drawerOpen = false" />

    <div class="main">
      <div class="mtop">
        <button
          type="button"
          class="ibtn"
          aria-controls="menu-principal"
          :aria-expanded="drawerOpen"
          :aria-label="drawerOpen ? 'Cerrar menú' : 'Abrir menú'"
          @click="drawerOpen = !drawerOpen"
        >
          <AppIcon :name="drawerOpen ? 'x' : 'menu'" />
        </button>
        <span class="title"><span class="logo" aria-hidden="true">MV</span>Manual Vivo</span>
        <RouterLink class="ibtn" :to="{ name: 'search' }" aria-label="Buscar"><AppIcon name="search" /></RouterLink>
      </div>

      <header class="top">
        <form class="srch" role="search" @submit.prevent="submitSearch">
          <AppIcon name="search" />
          <label for="busqueda-global" class="sr-only">Buscar procesos y procedimientos</label>
          <input
            id="busqueda-global"
            v-model="search"
            type="search"
            maxlength="100"
            placeholder="Buscar procesos, procedimientos o palabras clave…"
          />
        </form>
        <RouterLink v-if="session.user" class="who" :to="{ name: 'profile' }" aria-label="Ir a mi perfil">
          <div class="av" :style="{ background: avatarColor }" aria-hidden="true">{{ initials(session.user) }}</div>
          <div>
            <div class="n">{{ fullName(session.user) }}</div>
            <div class="r">{{ roleLine }}</div>
          </div>
        </RouterLink>
      </header>

      <main id="contenido" class="content" tabindex="-1">
        <RouterView :key="route.path" />
      </main>

      <nav class="bnav" aria-label="Navegación rápida">
        <RouterLink
          v-for="item in bottomItems"
          :key="item.key"
          :to="item.to"
          :class="{ on: active === item.key }"
          :aria-current="active === item.key ? 'page' : undefined"
        >
          <AppIcon :name="item.icon" />{{ item.label }}
        </RouterLink>
      </nav>
    </div>
  </div>
</template>
