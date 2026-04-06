<!--
  @file App.vue - 메인 레이아웃
  @project DanSat
  @author Dangam Corp.
-->
<template>
  <div id="dansat-app" data-service="dansat">
    <AppHeader
      :mapMode="mapMode"
      :count="trackingCount"
      @setMode="mapMode = $event"
    />
    <router-view v-slot="{ Component }">
      <component :is="Component" :mapMode="mapMode" />
    </router-view>
    <DanButton />
  </div>
</template>

<script setup>
import { ref, provide } from 'vue';
import AppHeader from './components/AppHeader.vue';
import DanButton from './components/DanButton.vue';

const mapMode = ref('2d');
const trackingCount = ref(0);

// MapView에서 위성 수 업데이트를 위한 provide
provide('updateTrackingCount', (n) => { trackingCount.value = n; });
</script>

<style>
#dansat-app {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text-primary);
  overflow: hidden;
}
</style>
