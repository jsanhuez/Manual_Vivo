import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import type { RoleName } from '@/api/types';
import AppLayout from '@/components/AppLayout.vue';
import { useSessionStore } from '@/stores/session';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    public?: boolean;
    guestOnly?: boolean;
    roles?: RoleName[];
    nav?: string;
  }
}

const ADMINS: RoleName[] = ['ADMIN'];

const numericId = (route: { params: Record<string, unknown> }) => ({ id: Number(route.params.id) });

const routes: RouteRecordRaw[] = [
  {
    path: '/ingresar',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { title: 'Iniciar sesión', public: true, guestOnly: true },
  },
  {
    path: '/recuperar',
    name: 'forgot-password',
    component: () => import('@/views/auth/ForgotPasswordView.vue'),
    meta: { title: 'Recuperar contraseña', public: true },
  },
  {
    path: '/restablecer',
    name: 'reset-password',
    component: () => import('@/views/auth/SetPasswordView.vue'),
    props: { mode: 'reset' },
    meta: { title: 'Nueva contraseña', public: true },
  },
  {
    path: '/activar',
    name: 'activate',
    component: () => import('@/views/auth/SetPasswordView.vue'),
    props: { mode: 'invite' },
    meta: { title: 'Activar cuenta', public: true },
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', name: 'home', redirect: { name: 'profile' } },
      {
        path: 'conocimiento',
        name: 'knowledge',
        component: () => import('@/views/knowledge/KnowledgeBaseView.vue'),
        meta: { title: 'Base de conocimiento', nav: 'knowledge' },
      },
      {
        path: 'procesos/:id(\\d+)',
        name: 'process',
        component: () => import('@/views/knowledge/ProcessView.vue'),
        props: numericId,
        meta: { title: 'Proceso', nav: 'knowledge' },
      },
      {
        path: 'procedimientos/:id(\\d+)',
        name: 'procedure',
        component: () => import('@/views/knowledge/ProcedureView.vue'),
        props: numericId,
        meta: { title: 'Procedimiento', nav: 'knowledge' },
      },
      { path: 'perfil', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: 'Mi perfil', nav: 'profile' } },
      {
        path: 'admin/usuarios',
        name: 'users',
        component: () => import('@/views/admin/UsersView.vue'),
        meta: { title: 'Usuarios', roles: ADMINS, nav: 'users' },
      },
      {
        path: 'admin/areas',
        name: 'areas',
        component: () => import('@/views/admin/AreasLevelsView.vue'),
        meta: { title: 'Áreas y niveles', roles: ADMINS, nav: 'areas' },
      },
      { path: 'sin-acceso', name: 'forbidden', component: () => import('@/views/ForbiddenView.vue'), meta: { title: 'Sin acceso' } },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { title: 'Página no encontrada' },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, _from, saved) => saved ?? (to.hash ? undefined : { top: 0 }),
});

// El servidor vuelve a validar cada permiso, esta guarda solo evita mostrar pantallas que no corresponden
router.beforeEach((to) => {
  const session = useSessionStore();
  const authenticated = session.ensureValid();
  if (!to.meta.public && !authenticated) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && authenticated) {
    return { name: 'home' };
  }
  if (to.meta.roles && (!session.role || !to.meta.roles.includes(session.role))) {
    return { name: 'forbidden' };
  }
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Manual Vivo` : 'Manual Vivo';
});

export default router;
