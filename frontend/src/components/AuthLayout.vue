<script setup lang="ts">
import AppIcon from './AppIcon.vue';

withDefaults(defineProps<{ heading: string; text: string; features?: boolean }>(), { features: false });
</script>

<template>
  <div class="auth">
    <section class="hero">
      <div class="brand">
        <div class="logo" aria-hidden="true">MV</div>
        <div>Manual Vivo<small>Recylink</small></div>
      </div>
      <div>
        <p class="hero-title">{{ heading }}</p>
        <p>{{ text }}</p>
        <ul v-if="features">
          <li><AppIcon name="layers" />Procesos y procedimientos según tu área y rol</li>
          <li><AppIcon name="search" />Búsqueda de texto completo en español</li>
          <li><AppIcon name="clock" />Historial de versiones de cada procedimiento</li>
        </ul>
      </div>
      <p class="legal">Uso interno · Acceso solo con cuenta corporativa</p>
    </section>
    <main class="form-wrap">
      <div class="form">
        <div class="brand auth-mobile-brand">
          <div class="logo" aria-hidden="true">MV</div>
          <div>Manual Vivo<small>Recylink</small></div>
        </div>
        <slot />
      </div>
    </main>
  </div>
</template>
