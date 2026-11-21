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
          <span class="muted small">Consola técnica</span>
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
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; }
.topbar-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 60px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand div { display: grid; line-height: 1.2; }
.logo { color: var(--accent); display: inline-flex; }
nav { display: flex; gap: 4px; }
nav a { color: var(--muted); text-decoration: none; padding: 7px 12px; border-radius: 8px; font-size: 14px; font-weight: 500; }
nav a:hover { color: var(--text); background: var(--surface-2); }
nav a.router-link-active { color: var(--accent); background: var(--accent-soft); }
.footer { padding: 32px 16px; text-align: center; }
@media (max-width: 560px) {
  .brand .muted { display: none; }
  nav a { padding: 6px 8px; font-size: 13px; }
}
</style>
