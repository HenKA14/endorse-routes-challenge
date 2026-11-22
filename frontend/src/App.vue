<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <header class="topbar">
    <div class="container topbar-inner">
      <div class="brand">
        <span class="logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M9 16h14M16 9v14" stroke="white" stroke-width="3" stroke-linecap="round" /></svg>
        </span>
        <div>
          <strong>Evolution</strong>
          <span class="small sub">Consola técnica</span>
        </div>
      </div>
      <nav aria-label="Principal">
        <RouterLink to="/endosos">Traductor de endosos</RouterLink>
        <RouterLink to="/rutas">Rutas de grúas</RouterLink>
      </nav>
    </div>
  </header>
  <main class="container">
    <RouterView />
  </main>
  <footer class="container footer muted small">Reto técnico · Technical Lead</footer>
</template>

<style scoped>
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); box-shadow: var(--shadow); position: sticky; top: 0; z-index: 10; }
.topbar-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 68px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand div { display: grid; line-height: 1.15; }
.brand strong { color: var(--accent); font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
.brand .sub { color: var(--text-2); }
.logo { color: var(--accent); display: inline-flex; }
nav { display: flex; gap: 8px; align-self: stretch; }
nav a {
  display: inline-flex; align-items: center; color: var(--text-2); text-decoration: none;
  padding: 0 12px; font-size: 16px; border-bottom: 2px solid transparent; margin-bottom: -1px;
}
nav a:hover { color: var(--accent); }
nav a.router-link-active { color: var(--accent); font-weight: 600; border-bottom-color: var(--accent); }
.footer { padding: 32px 16px; text-align: center; }
@media (max-width: 560px) {
  .brand .sub { display: none; }
  nav { gap: 2px; }
  nav a { padding: 0 6px; font-size: 14px; }
}
</style>
