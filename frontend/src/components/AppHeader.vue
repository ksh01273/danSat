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
      <!-- TLE 수집 상태 (DAN-14) -->
      <span
        v-if="tleStatus.ready"
        class="tle-status"
        :class="tleStatus.severity"
        :title="`마지막 TLE 수집: ${tleStatus.absolute}\n총 ${tleStatus.total.toLocaleString()}건`"
      >
        <Database :size="12" />
        <span class="tle-label">TLE</span>
        <span class="tle-age">{{ tleStatus.relative }}</span>
      </span>
      <span v-else-if="tleStatus.error" class="tle-status error" :title="tleStatus.error">
        <Database :size="12" />
        <span class="tle-label">TLE</span>
        <span class="tle-age">오류</span>
      </span>
      <div class="divider" v-if="tleStatus.ready || tleStatus.error"></div>
      <span class="sat-count" v-if="count > 0">
        <Eye :size="14" />
        {{ count }}
      </span>
    </div>
  </header>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { Satellite, Eye, Clock, Database } from 'lucide-vue-next';

defineProps({
  mapMode: { type: String, default: '2d' },
  count: { type: Number, default: 0 }
});

defineEmits(['setMode']);

const utcTime = ref('');
const kstTime = ref('');
let clockTimer = null;

// TLE 수집 상태 (DAN-14)
// - /api/satellites/collect/status 를 폴링해 가장 최신 last_collected 시각을 표시
// - 분/시간/일 단위 상대 시각 + KST 절대 시각 툴팁
// - severity: fresh (<3h), stale (<24h), old (≥24h)
const tleStatus = reactive({
  ready: false,
  error: null,
  relative: '',
  absolute: '',
  total: 0,
  severity: 'fresh',
});
let tleTimer = null;

function updateClock() {
  const now = new Date();
  utcTime.value = now.toISOString().substring(11, 19);
  // KST = UTC + 9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstTime.value = kst.toISOString().substring(11, 19);
}

/** "N분 전" / "N시간 전" / "N일 전" 형태의 상대 시각 */
function formatRelative(ms) {
  if (ms < 60 * 1000) return '방금';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.round(hr / 24);
  return `${day}일 전`;
}

/** "MM/DD HH:mm KST" 절대 시각 */
function formatAbsoluteKST(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const M = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const D = String(kst.getUTCDate()).padStart(2, '0');
  const H = String(kst.getUTCHours()).padStart(2, '0');
  const m = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${M}/${D} ${H}:${m} KST`;
}

async function refreshTleStatus() {
  try {
    const res = await fetch('/api/satellites/collect/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'status fetch failed');

    const cats = json.data?.categories || [];
    if (cats.length === 0) {
      tleStatus.ready = false;
      tleStatus.error = 'TLE 수집 데이터 없음';
      return;
    }

    // 가장 최신 last_collected 탐색
    let latestMs = 0;
    for (const c of cats) {
      if (!c.last_collected) continue;
      const t = new Date(c.last_collected).getTime();
      if (t > latestMs) latestMs = t;
    }
    if (!latestMs) {
      tleStatus.ready = false;
      tleStatus.error = 'last_collected 비어있음';
      return;
    }

    const ageMs = Date.now() - latestMs;
    tleStatus.relative = formatRelative(ageMs);
    tleStatus.absolute = formatAbsoluteKST(new Date(latestMs));
    tleStatus.total = json.data.total || 0;
    tleStatus.severity = ageMs < 3 * 3600 * 1000 ? 'fresh'
                        : ageMs < 24 * 3600 * 1000 ? 'stale'
                        : 'old';
    tleStatus.error = null;
    tleStatus.ready = true;
  } catch (err) {
    console.warn('[AppHeader] TLE status fetch failed:', err.message);
    tleStatus.ready = false;
    tleStatus.error = err.message;
  }
}

onMounted(() => {
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  refreshTleStatus();
  // 60초마다 TLE 수집 상태 갱신
  tleTimer = setInterval(refreshTleStatus, 60 * 1000);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (tleTimer) clearInterval(tleTimer);
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

/* TLE 수집 상태 뱃지 (DAN-14) */
.tle-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 10px;
  cursor: help;
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;
}
.tle-status .tle-label {
  font-weight: 700;
  letter-spacing: 0.3px;
}
.tle-status.fresh {
  color: var(--status-active);
  background: rgba(52, 211, 153, 0.1);
  border-color: rgba(52, 211, 153, 0.2);
}
.tle-status.stale {
  color: var(--status-warning, #F59E0B);
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.2);
}
.tle-status.old,
.tle-status.error {
  color: var(--status-danger, #EF4444);
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
}

@media (max-width: 768px) {
  .kst-clock { display: none; }
  .kst-clock + .divider { display: none; }
  .tle-status .tle-label { display: none; }
}
</style>
