/**
 * @file Vite 설정
 * @project DanSat
 * @author Dangam Corp.
 */

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5182,
    proxy: {
      '/api': {
        target: 'http://localhost:3009',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
