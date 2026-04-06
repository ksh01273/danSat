<!--
  @file SatelliteSidebar.vue - 좌측 위성 검색/목록 사이드바
  @project DanSat
  @author Dangam Corp.
-->
<template>
  <aside :class="['sidebar', { collapsed: !isOpen }]">
    <!-- 토글 버튼 -->
    <button class="sidebar-toggle" @click="isOpen = !isOpen">
      <PanelLeftClose v-if="isOpen" :size="16" />
      <PanelLeftOpen v-else :size="16" />
    </button>

    <div v-show="isOpen" class="sidebar-content">
      <!-- 검색 -->
      <div class="search-box">
        <Search :size="16" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="위성 검색 (ISS, Starlink...)"
          @keyup.enter="onSearch"
        />
      </div>

      <!-- 카테고리 필터 -->
      <div class="category-tabs">
        <button
          v-for="cat in categories"
          :key="cat.id"
          :class="['cat-btn', { active: selectedCategory === cat.id }]"
          @click="selectCategory(cat.id)"
        >{{ cat.name }}</button>
      </div>

      <!-- 위성 목록 -->
      <div class="sat-list">
        <div class="sat-list-header">
          <span class="list-title">위성 목록</span>
          <span class="list-count">{{ satellites.length }}개</span>
        </div>

        <div v-if="loading" class="loading-state">
          <Loader2 :size="20" class="spin" />
          <span>데이터 로딩 중...</span>
        </div>

        <div
          v-else
          v-for="sat in satellites"
          :key="sat.NORAD_CAT_ID"
          :class="['sat-card', { selected: selectedSat?.NORAD_CAT_ID === sat.NORAD_CAT_ID }]"
          @click="$emit('selectSat', sat)"
        >
          <div class="sat-name">{{ sat.OBJECT_NAME }}</div>
          <div class="sat-info">
            <span class="norad">NORAD {{ sat.NORAD_CAT_ID }}</span>
            <span :class="['orbit-badge', orbitType(sat)]">{{ orbitLabel(sat) }}</span>
          </div>
        </div>

        <div v-if="!loading && satellites.length === 0" class="empty-state">
          카테고리를 선택하거나 위성을 검색하세요
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue';
import { Search, PanelLeftClose, PanelLeftOpen, Loader2 } from 'lucide-vue-next';

const props = defineProps({
  satellites: { type: Array, default: () => [] },
  selectedSat: { type: Object, default: null },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['selectSat', 'search', 'loadCategory']);

const isOpen = ref(true);
const searchQuery = ref('');
const selectedCategory = ref('stations');

const categories = [
  { id: 'stations', name: '우주정거장' },
  { id: 'starlink', name: 'Starlink' },
  { id: 'weather', name: '기상' },
  { id: 'gps-ops', name: 'GPS' },
  { id: 'science', name: '과학' },
  { id: 'resource', name: '지구관측' },
];

function selectCategory(id) {
  selectedCategory.value = id;
  emit('loadCategory', id);
}

function onSearch() {
  if (searchQuery.value.length >= 2) {
    selectedCategory.value = '';
    emit('search', searchQuery.value);
  }
}

/** 궤도 유형 판별 (평균운동 기반, rev/day) */
function orbitType(sat) {
  const mm = sat.MEAN_MOTION || 0;
  if (mm > 11) return 'leo';
  if (mm > 1.5) return 'meo';
  if (mm > 0.9 && mm < 1.1) return 'geo';
  return 'heo';
}

function orbitLabel(sat) {
  const type = orbitType(sat);
  const labels = { leo: 'LEO', meo: 'MEO', geo: 'GEO', heo: 'HEO' };
  return labels[type] || 'N/A';
}
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s ease;
  flex-shrink: 0;
  z-index: 50;
}
.sidebar.collapsed { width: 0; overflow: hidden; }

.sidebar-toggle {
  position: absolute;
  right: -32px;
  top: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-secondary);
  z-index: 60;
}
.sidebar-toggle:hover { color: var(--accent-light); }

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.search-box {
  padding: 12px;
  position: relative;
}
.search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}
.search-box input {
  width: 100%;
  padding: 8px 12px 8px 36px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: var(--transition);
}
.search-box input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.search-box input::placeholder { color: var(--text-muted); }

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 12px;
}
.cat-btn {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg);
  border: 1px solid var(--border);
  transition: var(--transition);
}
.cat-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.cat-btn:hover:not(.active) {
  border-color: var(--accent);
  color: var(--text-primary);
}

.sat-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}
.sat-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 4px;
}
.list-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.list-count { font-size: 11px; color: var(--text-muted); }

.sat-card {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: var(--transition);
  margin-bottom: 4px;
}
.sat-card:hover {
  background: var(--bg-elevated);
  border-color: var(--border);
}
.sat-card.selected {
  background: var(--accent-bg);
  border-color: var(--border-active);
}
.sat-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.sat-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.norad { font-size: 11px; color: var(--text-muted); }
.orbit-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}
.orbit-badge.leo { background: rgba(52,211,153,0.15); color: var(--orbit-leo); }
.orbit-badge.meo { background: rgba(59,130,246,0.15); color: var(--orbit-meo); }
.orbit-badge.geo { background: rgba(245,158,11,0.15); color: var(--orbit-geo); }
.orbit-badge.heo { background: rgba(239,68,68,0.15); color: var(--orbit-heo); }

.loading-state, .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 16px;
  font-size: 13px;
  color: var(--text-muted);
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
