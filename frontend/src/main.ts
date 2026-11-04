import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { configureHttp } from './api/http';
import App from './App.vue';
import './assets/main.css';
import router from './router';
import { useCatalogStore } from './stores/catalog';
import { useSessionStore } from './stores/session';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const session = useSessionStore(pinia);
configureHttp(
  () => session.token,
  () => {
    session.clear();
    useCatalogStore(pinia).reset();
    const current = router.currentRoute.value;
    if (!current.meta.public) {
      void router.push({ name: 'login', query: { redirect: current.fullPath, expired: '1' } });
    }
  },
);

app.use(router);

// Refresca el perfil al abrir la aplicación para reflejar cambios de rol o área hechos por un administrador
if (session.ensureValid()) {
  void session.refreshProfile().catch(() => undefined);
}

app.mount('#app');
