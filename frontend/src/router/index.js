/**
 * @file Vue Router 설정
 * @project DanSat
 * @author Dangam Corp.
 */

import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/MapView.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
