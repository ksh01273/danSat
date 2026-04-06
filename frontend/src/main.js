/**
 * @file Vue 앱 진입점
 * @project DanSat
 * @author Dangam Corp.
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './assets/main.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
