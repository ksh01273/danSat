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
    component: () => import('../views/MapView.vue'),
    meta: { title: '위성 지도 - DanSat', description: '위성 이미지 및 지리 공간 데이터 통합 플랫폼' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.afterEach((to) => {
  const title = to.meta.title || 'DanSat — 위성 정보 지리 공간 플랫폼';
  document.title = title;
});

export default router;
