<!--
  @file DanButton.vue - DAN 서비스 전환 플로팅 버튼
  @project DanSat
  @author Dangam Corp.
-->
<template>
  <div class="dan-float">
    <button class="dan-btn" @click="showMenu = !showMenu" title="서비스 전환">DAN</button>
    <div v-if="showMenu" class="dan-menu">
      <a v-for="s in services" :key="s.id" :href="s.url" class="dan-menu-item">
        {{ s.name }}
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const showMenu = ref(false);
const services = [
  { id: 'fish', name: 'DanFish', url: 'https://fish.danmap.co.kr' },
  { id: 'war', name: 'DanWar', url: 'https://war.danmap.co.kr' },
  { id: 'pet', name: 'DanPet', url: 'https://pet.danmap.co.kr' },
  { id: 'travel', name: 'DanTravel', url: 'https://travel.danmap.co.kr' },
  { id: 'ocean', name: 'DanOcean', url: 'https://ocean.danmap.co.kr' },
  { id: 'geul', name: 'DanGeul', url: 'https://geul.danmap.co.kr' },
  { id: 'biz', name: 'DanBiz', url: 'https://biz.danmap.co.kr' },
  { id: 'sat', name: 'DanSat', url: 'https://sat.danmap.co.kr' },
];
</script>

<style scoped>
.dan-float {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 200;
}
.dan-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--dangam-primary);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transition: var(--transition);
}
.dan-btn:hover { transform: scale(1.1); }

.dan-menu {
  position: absolute;
  bottom: 56px;
  right: 0;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 8px 0;
  min-width: 140px;
  box-shadow: var(--shadow-lg);
}
.dan-menu-item {
  display: block;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-primary);
  transition: var(--transition);
}
.dan-menu-item:hover {
  background: var(--bg-elevated);
  text-decoration: none;
  color: var(--accent-light);
}
</style>
