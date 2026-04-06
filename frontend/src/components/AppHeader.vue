<!--
  @file AppHeader.vue - 상단 헤더 (UTC 시계 포함)
  @project DanSat
  @author Dangam Corp.
-->
<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo">
        <Satellite :size="20" class="logo-icon" />
        <span class="logo-text">DanSat</span>
      </div>
    </div>

    <div class="header-center">
      <div class="view-toggle">
        <button
          :class="['toggle-btn', { active: mapMode === '2d' }]"
          @click="$emit('setMode', '2d')"
        >2D</button>
        <button
          :class="['toggle-btn', { active: mapMode === '3d' }]"
          @click="$emit('setMode', '3d')"
        >3D</button>
      </div>
    </div>

    <div class="header-right">
      <!-- UTC 시계 -->
      <div class="utc-clock">
        <Clock :size="14" class="clock-icon" />
        <span class="clock-utc">{{ utcTime }}</span>
        <span class="clock-label">UTC</span>
      </div>
      <div class="divider"></div>
      <!-- KST 시계 -->
      <div class="kst-clock">
        <span class="clock-kst">{{ kstTime }}</span>
        <span class="clock-label">KST</span>
      </div>
      <div class="divider"></div>
      <span class="sat-count" v-if="count > 0">
        <Eye :size="14" />
        {{ count }}
      </span>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { Satellite, Eye, Clock } from 'lucide-vue-next';

defineProps({
  mapMode: { type: String, default: '2d' },
  count: { type: Number, default: 0 }
});

defineEmits(['setMode']);

const utcTime = ref('');
const kstTime = ref('');
let clockTimer = null;

function updateClock() {
  const now = new Date();
  utcTime.value = now.toISOString().substring(11, 19);
  // KST = UTC + 9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstTime.value = kst.toISOString().substring(11, 19);
}

onMounted(() => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<style scoped>
.app-header {
  height: var(--header-height);
  background: rgba(15, 15, 46, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
  flex-shrink: 0;
}

.header-left { display: flex; align-items: center; }

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-icon { color: var(--accent); }
.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.view-toggle {
  display: flex;
  background: var(--bg);
  border-radius: 20px;
  padding: 2px;
  border: 1px solid var(--border);
}
.toggle-btn {
  padding: 4px 16px;
  border-radius: 18px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  transition: var(--transition);
}
.toggle-btn.active {
  background: var(--accent);
  color: #fff;
}
.toggle-btn:hover:not(.active) {
  color: var(--text-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.utc-clock, .kst-clock {
  display: flex;
  align-items: center;
  gap: 5px;
}
.clock-icon { color: var(--accent-light); }
.clock-utc, .clock-kst {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  font-family: 'Pretendard Variable', monospace;
}
.clock-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.divider {
  width: 1px;
  height: 16px;
  background: var(--border);
}

.sat-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--status-active);
  font-weight: 500;
}

@media (max-width: 768px) {
  .kst-clock { display: none; }
  .kst-clock + .divider { display: none; }
}
</style>
