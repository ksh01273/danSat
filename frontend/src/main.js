/**
 * @file Vue 앱 진입점
 * @project DanSat
 * @author Dangam Corp.
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createHeadCore } from '@unhead/vue';
import App from './App.vue';
import router from './router/index.js';
import './assets/main.css';

const app = createApp(App);
const head = createHeadCore();
app.provide('usehead', head)
app.config.globalProperties.$unhead = head;
app.use(createPinia());
app.use(router);
app.mount('#app');
