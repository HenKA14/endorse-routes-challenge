import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/endosos' },
    {
      path: '/endosos',
      name: 'endosos',
      component: () => import('./views/EndorseView.vue'),
      meta: { title: 'Traductor de endosos' },
    },
    {
      path: '/rutas',
      name: 'rutas',
      component: () => import('./views/RoutesView.vue'),
      meta: { title: 'Rutas óptimas de grúas' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/endosos' },
  ],
});

router.afterEach((to) => {
  document.title = `${(to.meta.title as string) ?? 'Consola'} · Evolution`;
});
