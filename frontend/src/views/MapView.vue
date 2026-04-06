<!--
  @file MapView.vue - 메인 지도 뷰 (2D OpenLayers + 3D Three.js Globe)
  @project DanSat
  @author Dangam Corp.

  궤도 유형별 시각 구분:
    LEO (>11 rev/day)  = 녹색 원
    MEO (1.5~11)       = 파란 사각형
    GEO (0.9~1.1)      = 금색 다이아몬드
    HEO                = 빨간 삼각형

  관측 기능:
    - 위성 선택 시 촬영/관측 범위(Footprint) 원 표시
    - 관측자 위치에서의 방위각(Azimuth), 앙각(Elevation), 거리(Range) 계산
    - 가시 여부 판단 (앙각 > 0°)
-->
<template>
  <div class="map-container">
    <SatelliteSidebar
      :satellites="satellites"
      :selectedSat="selectedSat"
      :loading="loading"
      @selectSat="onSelectSat"
      @search="onSearch"
      @loadCategory="loadCategory"
    />

    <div class="map-area">
      <!-- 2D OpenLayers -->
      <div ref="mapRef" class="ol-map" v-show="mapMode === '2d'"></div>

      <!-- 3D Three.js Globe -->
      <div ref="globeRef" class="globe-canvas" v-show="mapMode === '3d'"></div>

      <!-- 궤도 유형 범례 -->
      <div class="orbit-legend glass-card">
        <div class="legend-title">궤도 유형</div>
        <div class="legend-item">
          <span class="legend-dot leo"></span>
          <span class="legend-label">LEO</span>
          <span class="legend-desc">저궤도 (160~2,000km)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot meo"></span>
          <span class="legend-label">MEO</span>
          <span class="legend-desc">중궤도 (2,000~35,786km)</span>
        </div>
        <div class="legend-item">
          <span class="legend-diamond geo"></span>
          <span class="legend-label">GEO</span>
          <span class="legend-desc">정지궤도 (~35,786km)</span>
        </div>
        <div class="legend-item">
          <span class="legend-tri heo"></span>
          <span class="legend-label">HEO</span>
          <span class="legend-desc">고타원궤도</span>
        </div>
        <div class="legend-divider"></div>
        <div class="legend-subtitle">커버리지 영역</div>
        <div class="legend-item">
          <span class="legend-ring ring-outer"></span>
          <span class="legend-desc">최대 가시 범위 (앙각 0°)</span>
        </div>
        <div class="legend-item">
          <span class="legend-ring ring-mid"></span>
          <span class="legend-desc">실용 통신 (앙각 10°)</span>
        </div>
        <div class="legend-item">
          <span class="legend-ring ring-inner"></span>
          <span class="legend-desc">고앙각 관측 (앙각 45°)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot nadir-icon"></span>
          <span class="legend-desc">직하점 (Nadir)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot observer-icon"></span>
          <span class="legend-desc">내 위치 (관측자)</span>
        </div>
      </div>

      <!-- 상태 카드 -->
      <div class="stat-cards">
        <div class="stat-card glass-card">
          <Satellite :size="18" class="stat-icon" />
          <div class="stat-value">{{ satellites.length }}</div>
          <div class="stat-label">총 위성</div>
        </div>
        <div class="stat-card glass-card">
          <Eye :size="18" class="stat-icon active" />
          <div class="stat-value">{{ visibleCount }}</div>
          <div class="stat-label">가시 위성</div>
        </div>
        <div class="stat-card glass-card">
          <Mountain :size="18" class="stat-icon" />
          <div class="stat-value">{{ avgAltitude }}</div>
          <div class="stat-label">평균 고도 (km)</div>
        </div>
        <div class="stat-card glass-card">
          <Gauge :size="18" class="stat-icon" />
          <div class="stat-value">{{ maxSpeed }}</div>
          <div class="stat-label">최대 속도 (km/s)</div>
        </div>
      </div>

      <!-- 선택 위성 상세 -->
      <div v-if="selectedSat" class="detail-panel glass-card">
        <div class="detail-header">
          <h3>{{ selectedSat.OBJECT_NAME }}</h3>
          <span :class="['orbit-type-badge', getOrbitType(selectedSat.MEAN_MOTION)]">
            {{ getOrbitLabel(selectedSat.MEAN_MOTION) }}
          </span>
          <button class="close-btn" @click="clearSelection">
            <X :size="16" />
          </button>
        </div>
        <div class="detail-body">
          <!-- 위치/속도 -->
          <div class="detail-section-title">위성 위치</div>
          <div class="detail-row">
            <span class="detail-label">NORAD ID</span>
            <span class="detail-value">{{ selectedSat.NORAD_CAT_ID }}</span>
          </div>
          <div class="detail-row" v-if="selectedPos">
            <span class="detail-label">위도 / 경도</span>
            <span class="detail-value">{{ selectedPos.lat.toFixed(2) }}° / {{ selectedPos.lng.toFixed(2) }}°</span>
          </div>
          <div class="detail-row" v-if="selectedPos">
            <span class="detail-label">고도</span>
            <span class="detail-value">{{ selectedPos.alt.toFixed(1) }} km</span>
          </div>
          <div class="detail-row" v-if="selectedPos">
            <span class="detail-label">속도</span>
            <span class="detail-value">{{ selectedPos.speed.toFixed(2) }} km/s</span>
          </div>

          <!-- 관측각 (Look Angles) -->
          <div class="detail-section-title" v-if="lookAngles">
            <MapPin :size="12" style="display:inline" />
            관측 정보 <span class="observer-label">({{ observerName }})</span>
          </div>
          <div class="detail-row" v-if="lookAngles">
            <span class="detail-label">방위각 (Azimuth)</span>
            <span class="detail-value">{{ lookAngles.azimuth.toFixed(2) }}°</span>
          </div>
          <div class="detail-row" v-if="lookAngles">
            <span class="detail-label">앙각 (Elevation)</span>
            <span :class="['detail-value', lookAngles.elevation > 0 ? 'visible' : 'not-visible']">
              {{ lookAngles.elevation.toFixed(2) }}°
            </span>
          </div>
          <div class="detail-row" v-if="lookAngles">
            <span class="detail-label">거리 (Range)</span>
            <span class="detail-value">{{ lookAngles.rangeSat.toFixed(0) }} km</span>
          </div>
          <div class="detail-row" v-if="lookAngles">
            <span class="detail-label">가시 여부</span>
            <span :class="['detail-value', 'visibility-badge', lookAngles.elevation > 0 ? 'yes' : 'no']">
              {{ lookAngles.elevation > 0 ? '관측 가능' : '수평선 아래' }}
            </span>
          </div>
          <div class="detail-section-title" v-if="footprintZones">커버리지 영역</div>
          <div class="detail-row" v-if="footprintZones">
            <span class="detail-label">최대 가시 (앙각 0°)</span>
            <span class="detail-value">반경 {{ footprintZones.el0.toFixed(0) }} km</span>
          </div>
          <div class="detail-row" v-if="footprintZones">
            <span class="detail-label">실용 통신 (앙각 10°)</span>
            <span class="detail-value">반경 {{ footprintZones.el10.toFixed(0) }} km</span>
          </div>
          <div class="detail-row" v-if="footprintZones">
            <span class="detail-label">고앙각 관측 (앙각 45°)</span>
            <span class="detail-value">반경 {{ footprintZones.el45.toFixed(0) }} km</span>
          </div>

          <!-- 궤도 요소 -->
          <div class="detail-section-title">궤도 요소</div>
          <div class="detail-row">
            <span class="detail-label">평균운동</span>
            <span class="detail-value">{{ selectedSat.MEAN_MOTION?.toFixed(4) }} rev/day</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">기울기</span>
            <span class="detail-value">{{ selectedSat.INCLINATION?.toFixed(2) }}°</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">이심률</span>
            <span class="detail-value">{{ selectedSat.ECCENTRICITY?.toFixed(6) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">주기</span>
            <span class="detail-value">{{ period }} 분</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, inject, nextTick } from 'vue';
import { Satellite, Eye, Mountain, Gauge, X, MapPin } from 'lucide-vue-next';
import SatelliteSidebar from '../components/SatelliteSidebar.vue';
// OpenLayers
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import LineString from 'ol/geom/LineString.js';
import { fromLonLat } from 'ol/proj.js';
import { Style, Circle as CircleStyle, RegularShape, Fill, Stroke, Text as OlText, Icon } from 'ol/style.js';
// satellite.js
import * as satellite from 'satellite.js';
// Three.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const props = defineProps({
  mapMode: { type: String, default: '2d' }
});

const updateTrackingCount = inject('updateTrackingCount', () => {});

const mapRef = ref(null);
const globeRef = ref(null);
const satellites = ref([]);
const selectedSat = ref(null);
const selectedPos = ref(null);
const loading = ref(false);
const positions = ref({});
const lookAngles = ref(null);
const footprintZones = ref(null);

// 관측자 위치 (기본: 서울)
const observerPos = ref({ lat: 37.5665, lng: 126.9780, alt: 0.038 }); // alt in km
const observerName = ref('서울');

// --- 2D ---
let olMap = null;
let satSource = null;
let orbitSource = null;
let footprintSource = null;
let observerSource = null;
let animFrame = null;

// --- 3D ---
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let earthMesh = null;
let satPointsObj = null;
let orbitLinesGroup = null;
let footprintGroup = null;
let observerMesh = null;
let geoRingMesh = null;
let globeAnimFrame = null;
let globe3dInited = false;

// =============================
//  궤도 유형 판별
// =============================
const ORBIT_CONFIG = {
  leo: { color: '#34D399', colorHex: 0x34D399, label: 'LEO', name: '저궤도' },
  meo: { color: '#3B82F6', colorHex: 0x3B82F6, label: 'MEO', name: '중궤도' },
  geo: { color: '#F59E0B', colorHex: 0xF59E0B, label: 'GEO', name: '정지궤도' },
  heo: { color: '#EF4444', colorHex: 0xEF4444, label: 'HEO', name: '고타원궤도' },
};

function getOrbitType(mm) {
  if (!mm) return 'leo';
  if (mm > 11) return 'leo';
  if (mm > 1.5) return 'meo';
  if (mm > 0.9 && mm < 1.1) return 'geo';
  return 'heo';
}

function getOrbitColor(mm) { return ORBIT_CONFIG[getOrbitType(mm)].color; }
function getOrbitLabel(mm) { return ORBIT_CONFIG[getOrbitType(mm)].label; }

// 통계
const visibleCount = computed(() => Object.values(positions.value).filter(p => p.alt > 0).length);
const avgAltitude = computed(() => {
  const v = Object.values(positions.value);
  return v.length ? Math.round(v.reduce((s, p) => s + p.alt, 0) / v.length) : 0;
});
const maxSpeed = computed(() => {
  const v = Object.values(positions.value);
  return v.length ? Math.max(...v.map(p => p.speed)).toFixed(1) : 0;
});
const period = computed(() => {
  if (!selectedSat.value?.MEAN_MOTION) return '-';
  return (1440 / selectedSat.value.MEAN_MOTION).toFixed(1);
});

// =============================
//  관측자 위치 (Geolocation)
// =============================
function initGeolocation() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        observerPos.value = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          alt: (pos.coords.altitude || 0) / 1000 // m → km
        };
        observerName.value = '내 위치';
        updateObserverMarker();
      },
      () => {
        // 실패 시 서울 기본값 유지
        updateObserverMarker();
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  } else {
    updateObserverMarker();
  }
}

// =============================
//  관측각(Look Angles) 계산
// =============================
const R_EARTH = 6371; // km
const DEG = 180 / Math.PI;

function calcLookAngles(satPos, obs) {
  // satellite.js 형식으로 변환
  const obsGd = {
    longitude: obs.lng / DEG, // radians
    latitude: obs.lat / DEG,
    height: obs.alt // km
  };

  const now = new Date();
  const gmst = satellite.gstime(now);

  // 위성의 ECI 좌표 계산 (선택된 위성의 satrec 필요)
  if (!selectedSat.value) return null;
  const satrec = gpToSatrec(selectedSat.value);
  if (!satrec) return null;

  const pv = satellite.propagate(satrec, now);
  if (!pv.position || typeof pv.position === 'boolean') return null;

  const posEcf = satellite.eciToEcf(pv.position, gmst);
  const la = satellite.ecfToLookAngles(obsGd, posEcf);

  return {
    azimuth: la.azimuth * DEG,
    elevation: la.elevation * DEG,
    rangeSat: la.rangeSat, // km
  };
}

/**
 * 특정 앙각(elevation angle)에서의 지표면 커버리지 반경 (km)
 * @param {number} altKm - 위성 고도 (km)
 * @param {number} elDeg - 최소 앙각 (도). 0°=지평선, 90°=직하점
 * @returns {number} 지표면 반경 (km)
 *
 * 공식: λ = arccos( R/(R+h) · cos(el) ) - el
 * 여기서 λ = 지구 중심각, R = 지구 반경, h = 위성 고도, el = 최소 앙각
 */
function calcFootprintRadiusKm(altKm, elDeg = 0) {
  const elRad = elDeg * Math.PI / 180;
  const sinRho = R_EARTH / (R_EARTH + altKm);
  // 지구 중심각
  const centralAngle = Math.acos(sinRho * Math.cos(elRad)) - elRad;
  if (centralAngle <= 0) return 0;
  return R_EARTH * centralAngle;
}

/** 3가지 앙각 기준 커버리지 반경 계산 */
function calcAllFootprintZones(altKm) {
  return {
    el0: calcFootprintRadiusKm(altKm, 0),    // 최대 가시 (지평선)
    el10: calcFootprintRadiusKm(altKm, 10),   // 실용 통신/관측
    el45: calcFootprintRadiusKm(altKm, 45),   // 고앙각 (직하 부근)
  };
}

/**
 * 위경도 기준 원형 폴리곤 좌표 생성 (촬영범위)
 */
function createFootprintCoords(centerLat, centerLng, radiusKm, numPoints = 64) {
  const coords = [];
  const angularRadius = radiusKm / R_EARTH; // radians

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (2 * Math.PI * i) / numPoints;
    const lat1 = centerLat / DEG;
    const lng1 = centerLng / DEG;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularRadius) +
      Math.cos(lat1) * Math.sin(angularRadius) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(lat1),
      Math.cos(angularRadius) - Math.sin(lat1) * Math.sin(lat2)
    );

    coords.push([lng2 * DEG, lat2 * DEG]);
  }
  return coords;
}

// =============================
//  모드 전환
// =============================
watch(() => props.mapMode, async (mode) => {
  if (mode === '3d') {
    await nextTick();
    if (!globe3dInited) initGlobe3D();
    else onGlobeResize();
    update3DSatellites();
    updateObserver3D();
    startGlobeAnim();
  } else {
    stopGlobeAnim();
    await nextTick();
    if (olMap) olMap.updateSize();
  }
});

watch(() => satellites.value.length, (n) => updateTrackingCount(n));

onMounted(() => {
  initMap();
  initGeolocation();
  loadCategory('stations');
});

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame);
  stopGlobeAnim();
  if (renderer) { renderer.dispose(); renderer = null; }
});

// =============================
//  2D OpenLayers
// =============================
function initMap() {
  satSource = new VectorSource();
  orbitSource = new VectorSource();
  footprintSource = new VectorSource();
  observerSource = new VectorSource();

  olMap = new OlMap({
    target: mapRef.value,
    layers: [
      new TileLayer({
        source: new XYZ({
          url: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          attributions: '© CARTO © OpenStreetMap'
        })
      }),
      new VectorLayer({ source: footprintSource, zIndex: 1 }), // 촬영범위 (아래)
      new VectorLayer({ source: orbitSource, zIndex: 2 }),
      new VectorLayer({ source: satSource, zIndex: 3 }),
      new VectorLayer({ source: observerSource, zIndex: 4 }), // 관측자
    ],
    view: new View({
      center: fromLonLat([127, 36]),
      zoom: 3,
      maxZoom: 18,
      minZoom: 2
    }),
    controls: []
  });

  olMap.on('click', (evt) => {
    const feature = olMap.forEachFeatureAtPixel(evt.pixel, f => f, {
      layerFilter: l => l.getSource() === satSource
    });
    if (feature) {
      const sat = feature.get('satData');
      if (sat) onSelectSat(sat);
    }
  });

  olMap.on('pointermove', (evt) => {
    const hit = olMap.forEachFeatureAtPixel(evt.pixel, () => true, {
      layerFilter: l => l.getSource() === satSource
    });
    olMap.getTargetElement().style.cursor = hit ? 'pointer' : '';
  });
}

function updateObserverMarker() {
  if (!observerSource) return;
  observerSource.clear();

  const obs = observerPos.value;
  const feature = new Feature({
    geometry: new Point(fromLonLat([obs.lng, obs.lat]))
  });
  feature.setStyle(new Style({
    image: new CircleStyle({
      radius: 6,
      fill: new Fill({ color: '#FF7F00' }),
      stroke: new Stroke({ color: '#fff', width: 2 }),
    }),
    text: new OlText({
      text: observerName.value,
      font: 'bold 11px Pretendard Variable',
      fill: new Fill({ color: '#FF7F00' }),
      stroke: new Stroke({ color: '#000', width: 3 }),
      offsetY: -14
    })
  }));
  observerSource.addFeature(feature);
}

function createSatStyle2D(sat, isSelected) {
  const mm = sat.MEAN_MOTION || 0;
  const type = getOrbitType(mm);
  const color = ORBIT_CONFIG[type].color;
  const strokeW = isSelected ? 2.5 : 1;
  const strokeColor = isSelected ? '#fff' : 'rgba(255,255,255,0.6)';

  let image;
  if (type === 'geo') {
    image = new RegularShape({ points: 4, radius: isSelected ? 10 : 7, angle: Math.PI / 4,
      fill: new Fill({ color }), stroke: new Stroke({ color: strokeColor, width: strokeW }) });
  } else if (type === 'heo') {
    image = new RegularShape({ points: 3, radius: isSelected ? 9 : 6, angle: 0,
      fill: new Fill({ color }), stroke: new Stroke({ color: strokeColor, width: strokeW }) });
  } else if (type === 'meo') {
    image = new RegularShape({ points: 4, radius: isSelected ? 9 : 6, angle: 0,
      fill: new Fill({ color }), stroke: new Stroke({ color: strokeColor, width: strokeW }) });
  } else {
    image = new CircleStyle({ radius: isSelected ? 7 : 4,
      fill: new Fill({ color }), stroke: new Stroke({ color: strokeColor, width: strokeW }) });
  }

  return new Style({
    image,
    text: isSelected ? new OlText({
      text: sat.OBJECT_NAME, font: 'bold 12px Pretendard Variable',
      fill: new Fill({ color: '#fff' }), stroke: new Stroke({ color: '#000', width: 3 }), offsetY: -18
    }) : undefined
  });
}

/** 2D 커버리지 동심원 그리기 (앙각 0°, 10°, 45°) */
function drawFootprint2D(satPos, altKm) {
  footprintSource.clear();
  if (!satPos) return;

  const zones = calcAllFootprintZones(altKm);
  footprintZones.value = zones;

  // --- 앙각 0° (최대 가시 범위) ---
  const coords0 = createFootprintCoords(satPos.lat, satPos.lng, zones.el0);
  const proj0 = coords0.map(([lng, lat]) => fromLonLat([lng, lat]));
  const poly0 = new Feature({ geometry: new Polygon([proj0]) });
  poly0.setStyle(new Style({
    fill: new Fill({ color: 'rgba(124, 58, 237, 0.04)' }),
    stroke: new Stroke({ color: 'rgba(124, 58, 237, 0.25)', width: 1, lineDash: [8, 6] })
  }));
  footprintSource.addFeature(poly0);

  // --- 앙각 10° (실용 통신/관측) ---
  if (zones.el10 > 0) {
    const coords10 = createFootprintCoords(satPos.lat, satPos.lng, zones.el10);
    const proj10 = coords10.map(([lng, lat]) => fromLonLat([lng, lat]));
    const poly10 = new Feature({ geometry: new Polygon([proj10]) });
    poly10.setStyle(new Style({
      fill: new Fill({ color: 'rgba(124, 58, 237, 0.06)' }),
      stroke: new Stroke({ color: 'rgba(124, 58, 237, 0.40)', width: 1.5, lineDash: [6, 4] })
    }));
    footprintSource.addFeature(poly10);
  }

  // --- 앙각 45° (고앙각 관측 = 직하 부근) ---
  if (zones.el45 > 0) {
    const coords45 = createFootprintCoords(satPos.lat, satPos.lng, zones.el45);
    const proj45 = coords45.map(([lng, lat]) => fromLonLat([lng, lat]));
    const poly45 = new Feature({ geometry: new Polygon([proj45]) });
    poly45.setStyle(new Style({
      fill: new Fill({ color: 'rgba(124, 58, 237, 0.12)' }),
      stroke: new Stroke({ color: 'rgba(167, 139, 250, 0.6)', width: 2 })
    }));
    footprintSource.addFeature(poly45);
  }

  // --- 직하점(Nadir) 마커 ---
  const nadirFeature = new Feature({ geometry: new Point(fromLonLat([satPos.lng, satPos.lat])) });
  nadirFeature.setStyle(new Style({
    image: new CircleStyle({
      radius: 4, fill: new Fill({ color: '#A78BFA' }),
      stroke: new Stroke({ color: '#fff', width: 1.5 })
    }),
    text: new OlText({
      text: '직하점', font: '10px Pretendard Variable',
      fill: new Fill({ color: '#A78BFA' }),
      stroke: new Stroke({ color: '#000', width: 2 }),
      offsetY: 12
    })
  }));
  footprintSource.addFeature(nadirFeature);

  // --- 관측자 → 위성 시선 (가시 시) ---
  const obs = observerPos.value;
  if (lookAngles.value && lookAngles.value.elevation > 0) {
    const lineFeature = new Feature({
      geometry: new LineString([fromLonLat([obs.lng, obs.lat]), fromLonLat([satPos.lng, satPos.lat])])
    });
    lineFeature.setStyle(new Style({
      stroke: new Stroke({ color: 'rgba(255,127,0,0.6)', width: 1.5, lineDash: [4, 4] })
    }));
    footprintSource.addFeature(lineFeature);
  }
}

// =============================
//  3D Globe (Three.js)
// =============================
const EARTH_RADIUS_3D = 5;
const SAT_SCALE = EARTH_RADIUS_3D / R_EARTH;
const GEO_ALT = 35786;

function initGlobe3D() {
  if (!globeRef.value) return;
  globe3dInited = true;
  const w = globeRef.value.clientWidth;
  const h = globeRef.value.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070714);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  camera.position.set(0, 8, 16);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  globeRef.value.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 7;
  controls.maxDistance = 50;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.3;

  // Earth
  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS_3D, 64, 64);
  const earthMat = new THREE.MeshPhongMaterial({ color: 0x1a1a4e, emissive: 0x080828, specular: 0x333366, shininess: 8 });
  earthMesh = new THREE.Mesh(earthGeo, earthMat);
  scene.add(earthMesh);

  const textureLoader = new THREE.TextureLoader();
  textureLoader.crossOrigin = 'anonymous';
  textureLoader.load('https://unpkg.com/three-globe/example/img/earth-night.jpg', (tex) => {
    earthMesh.material.map = tex;
    earthMesh.material.color.set(0xffffff);
    earthMesh.material.emissive.set(0x112244);
    earthMesh.material.needsUpdate = true;
  }, undefined, () => createGlobeGrid());

  createGlobeGrid();

  // Atmosphere shader
  const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS_3D * 1.02, 64, 64);
  const atmosMat = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vN; void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec3 vN; void main(){float i=pow(0.65-dot(vN,vec3(0,0,1)),2.0);gl_FragColor=vec4(0.3,0.3,1.0,1.0)*i*0.4;}`,
    blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true
  });
  scene.add(new THREE.Mesh(atmosGeo, atmosMat));

  createGeoRing();
  createStars();

  scene.add(new THREE.AmbientLight(0x445577, 2.0));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(10, 5, 10);
  scene.add(dirLight);

  satPointsObj = new THREE.Group(); scene.add(satPointsObj);
  orbitLinesGroup = new THREE.Group(); scene.add(orbitLinesGroup);
  footprintGroup = new THREE.Group(); scene.add(footprintGroup);

  window.addEventListener('resize', onGlobeResize);
}

function createGlobeGrid() {
  const m = new THREE.LineBasicMaterial({ color: 0x2a2a5e, transparent: true, opacity: 0.25 });
  const r = EARTH_RADIUS_3D * 1.002;
  for (let lat = -60; lat <= 60; lat += 30) {
    const phi = (90 - lat) * Math.PI / 180, rr = r * Math.sin(phi), y = r * Math.cos(phi), pts = [];
    for (let i = 0; i <= 72; i++) { const t = (i / 72) * Math.PI * 2; pts.push(new THREE.Vector3(rr * Math.cos(t), y, rr * Math.sin(t))); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [], t = lon * Math.PI / 180;
    for (let i = 0; i <= 72; i++) { const p = (i / 72) * Math.PI; pts.push(new THREE.Vector3(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t))); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m));
  }
}

function createGeoRing() {
  const geoR = EARTH_RADIUS_3D + GEO_ALT * SAT_SCALE;
  const pts = [];
  for (let i = 0; i <= 128; i++) { const t = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(geoR * Math.cos(t), 0, geoR * Math.sin(t))); }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineDashedMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.25, dashSize: 0.3, gapSize: 0.15 });
  geoRingMesh = new THREE.Line(geo, mat);
  geoRingMesh.computeLineDistances();
  scene.add(geoRingMesh);
}

function createStars() {
  const g = new THREE.BufferGeometry(), v = new Float32Array(3000);
  for (let i = 0; i < 3000; i++) v[i] = (Math.random() - 0.5) * 200;
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.7 })));
}

function latLngToVec3(lat, lng, altitude = 0) {
  const r = EARTH_RADIUS_3D + altitude * SAT_SCALE;
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function updateObserver3D() {
  if (!scene) return;
  if (observerMesh) { scene.remove(observerMesh); observerMesh.geometry?.dispose(); observerMesh.material?.dispose(); }
  const obs = observerPos.value;
  const geo = new THREE.SphereGeometry(0.06, 8, 8);
  const mat = new THREE.MeshBasicMaterial({ color: 0xFF7F00 });
  observerMesh = new THREE.Mesh(geo, mat);
  observerMesh.position.copy(latLngToVec3(obs.lat, obs.lng, 0));
  scene.add(observerMesh);
}

function create3DSatMesh(type, isSelected) {
  const color = new THREE.Color(ORBIT_CONFIG[type].colorHex);
  if (type === 'geo') return new THREE.Mesh(new THREE.OctahedronGeometry(isSelected ? 0.12 : 0.08), new THREE.MeshBasicMaterial({ color }));
  if (type === 'heo') return new THREE.Mesh(new THREE.TetrahedronGeometry(isSelected ? 0.1 : 0.07), new THREE.MeshBasicMaterial({ color }));
  if (type === 'meo') { const s = isSelected ? 0.1 : 0.06; return new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshBasicMaterial({ color })); }
  return new THREE.Mesh(new THREE.SphereGeometry(isSelected ? 0.07 : 0.04, 6, 6), new THREE.MeshBasicMaterial({ color, transparent: !isSelected, opacity: isSelected ? 1 : 0.85 }));
}

function update3DSatellites() {
  if (!satPointsObj) return;
  while (satPointsObj.children.length) { const c = satPointsObj.children[0]; c.geometry?.dispose(); c.material?.dispose(); satPointsObj.remove(c); }
  const now = new Date(), newPos = {};

  satellites.value.forEach(sat => {
    const satrec = gpToSatrec(sat); if (!satrec) return;
    const pos = calcPosition(satrec, now); if (!pos) return;
    newPos[sat.NORAD_CAT_ID] = pos;
    const type = getOrbitType(sat.MEAN_MOTION), isSel = selectedSat.value?.NORAD_CAT_ID === sat.NORAD_CAT_ID;
    const mesh = create3DSatMesh(type, isSel);
    mesh.position.copy(latLngToVec3(pos.lat, pos.lng, pos.alt));
    mesh.userData = { sat };
    satPointsObj.add(mesh);
    if (isSel) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: ORBIT_CONFIG[type].colorHex, transparent: true, opacity: 0.2 }));
      glow.position.copy(mesh.position);
      satPointsObj.add(glow);
    }
  });

  positions.value = newPos;
  if (selectedSat.value) {
    selectedPos.value = newPos[selectedSat.value.NORAD_CAT_ID] || null;
    updateLookAngles();
  }
}

/** 3D 촬영범위(footprint) — 3단계 동심원 그리기 */
function drawFootprint3D(satPos, altKm) {
  if (!footprintGroup) return;
  while (footprintGroup.children.length) { const c = footprintGroup.children[0]; c.geometry?.dispose(); c.material?.dispose(); footprintGroup.remove(c); }
  if (!satPos) return;

  const zones = calcAllFootprintZones(altKm);
  footprintZones.value = zones;

  // --- 앙각 0° (최대 가시 범위) ---
  const coords0 = createFootprintCoords(satPos.lat, satPos.lng, zones.el0, 64);
  const pts0 = coords0.map(([lng, lat]) => latLngToVec3(lat, lng, 0));
  const lineGeo0 = new THREE.BufferGeometry().setFromPoints(pts0);
  const lineMat0 = new THREE.LineBasicMaterial({ color: 0x7C3AED, transparent: true, opacity: 0.25 });
  const line0 = new THREE.Line(lineGeo0, lineMat0);
  line0.computeLineDistances();
  footprintGroup.add(line0);

  // --- 앙각 10° (실용 통신/관측) ---
  if (zones.el10 > 0) {
    const coords10 = createFootprintCoords(satPos.lat, satPos.lng, zones.el10, 64);
    const pts10 = coords10.map(([lng, lat]) => latLngToVec3(lat, lng, 0));
    const lineGeo10 = new THREE.BufferGeometry().setFromPoints(pts10);
    const lineMat10 = new THREE.LineBasicMaterial({ color: 0x7C3AED, transparent: true, opacity: 0.4 });
    footprintGroup.add(new THREE.Line(lineGeo10, lineMat10));
  }

  // --- 앙각 45° (고앙각 관측) ---
  if (zones.el45 > 0) {
    const coords45 = createFootprintCoords(satPos.lat, satPos.lng, zones.el45, 64);
    const pts45 = coords45.map(([lng, lat]) => latLngToVec3(lat, lng, 0));
    const lineGeo45 = new THREE.BufferGeometry().setFromPoints(pts45);
    const lineMat45 = new THREE.LineBasicMaterial({ color: 0xA78BFA, transparent: true, opacity: 0.6 });
    footprintGroup.add(new THREE.Line(lineGeo45, lineMat45));
  }

  // 위성 → 직하점 연결선
  const satVec = latLngToVec3(satPos.lat, satPos.lng, altKm);
  const nadirVec = latLngToVec3(satPos.lat, satPos.lng, 0);
  const connGeo = new THREE.BufferGeometry().setFromPoints([satVec, nadirVec]);
  const connMat = new THREE.LineDashedMaterial({ color: 0x7C3AED, transparent: true, opacity: 0.3, dashSize: 0.1, gapSize: 0.05 });
  const connLine = new THREE.Line(connGeo, connMat);
  connLine.computeLineDistances();
  footprintGroup.add(connLine);

  // 직하점(Nadir) 마커 구체
  const nadirDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xA78BFA })
  );
  nadirDot.position.copy(nadirVec);
  footprintGroup.add(nadirDot);

  // 관측자 → 위성 연결선 (가시 시)
  if (lookAngles.value && lookAngles.value.elevation > 0) {
    const obsVec = latLngToVec3(observerPos.value.lat, observerPos.value.lng, 0);
    const losGeo = new THREE.BufferGeometry().setFromPoints([obsVec, satVec]);
    const losMat = new THREE.LineDashedMaterial({ color: 0xFF7F00, transparent: true, opacity: 0.5, dashSize: 0.1, gapSize: 0.05 });
    const losLine = new THREE.Line(losGeo, losMat);
    losLine.computeLineDistances();
    footprintGroup.add(losLine);
  }
}

function draw3DOrbit(sat) {
  if (!orbitLinesGroup) return;
  while (orbitLinesGroup.children.length) { const c = orbitLinesGroup.children[0]; c.geometry?.dispose(); c.material?.dispose(); orbitLinesGroup.remove(c); }
  const satrec = gpToSatrec(sat); if (!satrec) return;
  const mm = sat.MEAN_MOTION || 14, periodMin = 1440 / mm, color = new THREE.Color(getOrbitColor(mm)), now = new Date(), points = [];
  const step = Math.max(1, Math.floor(periodMin / 180));
  for (let i = 0; i <= periodMin; i += step) { const t = new Date(now.getTime() + i * 60000); const pos = calcPosition(satrec, t); if (pos) points.push(latLngToVec3(pos.lat, pos.lng, pos.alt)); }
  if (points.length < 2) return;
  orbitLinesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })));
}

function startGlobeAnim() {
  stopGlobeAnim();
  let last = 0;
  function animate(t) {
    globeAnimFrame = requestAnimationFrame(animate);
    if (controls) controls.update();
    if (t - last > 2000) { last = t; update3DSatellites(); }
    if (renderer && scene && camera) renderer.render(scene, camera);
  }
  globeAnimFrame = requestAnimationFrame(animate);
}
function stopGlobeAnim() { if (globeAnimFrame) { cancelAnimationFrame(globeAnimFrame); globeAnimFrame = null; } }
function onGlobeResize() {
  if (!globeRef.value || !camera || !renderer) return;
  const w = globeRef.value.clientWidth, h = globeRef.value.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
}

// =============================
//  위성 궤도 계산 (공통)
// =============================
function gpToSatrec(gp) {
  if (!gp.TLE_LINE1 || !gp.TLE_LINE2) return null;
  return satellite.twoline2satrec(gp.TLE_LINE1, gp.TLE_LINE2);
}

function calcPosition(satrec, date = new Date()) {
  const pv = satellite.propagate(satrec, date);
  if (!pv.position || typeof pv.position === 'boolean') return null;
  const gmst = satellite.gstime(date);
  const gd = satellite.eciToGeodetic(pv.position, gmst);
  return {
    lat: satellite.degreesLat(gd.latitude), lng: satellite.degreesLong(gd.longitude),
    alt: gd.height, speed: Math.sqrt(pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2)
  };
}

function calcOrbitPath(satrec, mm) {
  const p = 1440 / mm, pts = [], now = new Date(), step = Math.max(1, Math.floor(p / 120));
  for (let i = 0; i < p; i += step) { const t = new Date(now.getTime() + i * 60000); const pos = calcPosition(satrec, t); if (pos) pts.push([pos.lng, pos.lat]); }
  return pts;
}

/** 관측각 업데이트 */
function updateLookAngles() {
  if (!selectedSat.value || !selectedPos.value) { lookAngles.value = null; footprintZones.value = null; return; }
  lookAngles.value = calcLookAngles(selectedPos.value, observerPos.value);
}

// =============================
//  2D 지도 업데이트
// =============================
function updateMapFeatures() {
  if (!satSource) return;
  satSource.clear();
  const now = new Date(), newPos = {};

  satellites.value.forEach(sat => {
    const satrec = gpToSatrec(sat); if (!satrec) return;
    const pos = calcPosition(satrec, now); if (!pos) return;
    newPos[sat.NORAD_CAT_ID] = pos;
    const isSel = selectedSat.value?.NORAD_CAT_ID === sat.NORAD_CAT_ID;
    const feature = new Feature({ geometry: new Point(fromLonLat([pos.lng, pos.lat])), satData: sat });
    feature.setStyle(createSatStyle2D(sat, isSel));
    satSource.addFeature(feature);
  });

  positions.value = newPos;

  if (selectedSat.value) {
    selectedPos.value = newPos[selectedSat.value.NORAD_CAT_ID] || null;
    updateLookAngles();
    if (selectedPos.value) drawFootprint2D(selectedPos.value, selectedPos.value.alt);
  }

  if (props.mapMode === '2d') {
    animFrame = requestAnimationFrame(() => setTimeout(updateMapFeatures, 2000));
  }
}

function drawOrbit(sat) {
  if (!orbitSource) return;
  orbitSource.clear();
  const satrec = gpToSatrec(sat); if (!satrec) return;
  const mm = sat.MEAN_MOTION || 14, path = calcOrbitPath(satrec, mm);
  if (path.length < 2) return;
  const segs = [[]];
  for (let i = 0; i < path.length; i++) {
    segs[segs.length - 1].push(path[i]);
    if (i < path.length - 1 && Math.abs(path[i][0] - path[i + 1][0]) > 180) segs.push([]);
  }
  const color = getOrbitColor(mm);
  segs.forEach(seg => {
    if (seg.length < 2) return;
    const f = new Feature({ geometry: new LineString(seg.map(([lng, lat]) => fromLonLat([lng, lat]))) });
    f.setStyle(new Style({ stroke: new Stroke({ color, width: 1.5, lineDash: [8, 4] }) }));
    orbitSource.addFeature(f);
  });
}

// =============================
//  데이터 로드 / 선택
// =============================
async function loadCategory(group) {
  loading.value = true;
  clearSelection();
  try {
    const res = await fetch(`/api/satellites/tle?group=${group}`);
    const json = await res.json();
    if (json.success) {
      satellites.value = group === 'starlink' ? json.data.slice(0, 100) : json.data;
      positions.value = {};
      if (animFrame) cancelAnimationFrame(animFrame);
      if (props.mapMode === '2d') updateMapFeatures();
      else update3DSatellites();
    }
  } catch (err) { console.error('카테고리 로드 실패:', err); }
  finally { loading.value = false; }
}

async function onSearch(query) {
  loading.value = true;
  clearSelection();
  try {
    const res = await fetch(`/api/satellites/search?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (json.success) {
      satellites.value = json.data;
      positions.value = {};
      if (animFrame) cancelAnimationFrame(animFrame);
      if (props.mapMode === '2d') updateMapFeatures();
      else update3DSatellites();
    }
  } catch (err) { console.error('검색 실패:', err); }
  finally { loading.value = false; }
}

function clearSelection() {
  selectedSat.value = null;
  selectedPos.value = null;
  lookAngles.value = null;
  footprintZones.value = null;
  orbitSource?.clear();
  footprintSource?.clear();
  if (footprintGroup) { while (footprintGroup.children.length) { const c = footprintGroup.children[0]; c.geometry?.dispose(); c.material?.dispose(); footprintGroup.remove(c); } }
  if (orbitLinesGroup) { while (orbitLinesGroup.children.length) { const c = orbitLinesGroup.children[0]; c.geometry?.dispose(); c.material?.dispose(); orbitLinesGroup.remove(c); } }
}

function onSelectSat(sat) {
  selectedSat.value = sat;
  const pos = positions.value[sat.NORAD_CAT_ID];
  selectedPos.value = pos || null;

  // 관측각 계산
  updateLookAngles();

  if (props.mapMode === '2d') {
    drawOrbit(sat);
    if (pos) {
      drawFootprint2D(pos, pos.alt);
      olMap.getView().animate({ center: fromLonLat([pos.lng, pos.lat]), zoom: 4, duration: 500 });
    }
  } else {
    draw3DOrbit(sat);
    if (pos) {
      drawFootprint3D(pos, pos.alt);
      if (controls) controls.target.copy(latLngToVec3(pos.lat, pos.lng, 0));
    }
  }
}
</script>

<style scoped>
.map-container { flex: 1; display: flex; overflow: hidden; }
.map-area { flex: 1; position: relative; }
.ol-map { width: 100%; height: 100%; }
.globe-canvas { width: 100%; height: 100%; background: #070714; }

/* 범례 */
.orbit-legend { position: absolute; top: 16px; left: 16px; padding: 12px 14px; z-index: 10; min-width: 180px; }
.legend-title { font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
.legend-item { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.legend-dot.leo { background: var(--orbit-leo); }
.legend-dot.meo { background: var(--orbit-meo); }
.legend-diamond { width: 10px; height: 10px; flex-shrink: 0; transform: rotate(45deg); }
.legend-diamond.geo { background: var(--orbit-geo); }
.legend-tri { width: 0; height: 0; flex-shrink: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 10px solid var(--orbit-heo); }
.legend-label { font-size: 12px; font-weight: 600; color: var(--text-primary); min-width: 30px; }
.legend-desc { font-size: 10px; color: var(--text-muted); }
.legend-divider { height: 1px; background: var(--border); margin: 6px 0; }
.legend-subtitle { font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 2px; }
.legend-ring { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-sizing: border-box; }
.ring-outer { border: 1.5px dashed rgba(124,58,237,0.3); background: rgba(124,58,237,0.04); }
.ring-mid { border: 1.5px dashed rgba(124,58,237,0.5); background: rgba(124,58,237,0.08); }
.ring-inner { border: 2px solid rgba(167,139,250,0.6); background: rgba(124,58,237,0.15); }
.nadir-icon { width: 8px; height: 8px; border-radius: 50%; background: #A78BFA; border: 1.5px solid #fff; flex-shrink: 0; }
.observer-icon { width: 8px; height: 8px; border-radius: 50%; background: #FF7F00; border: 1.5px solid #fff; flex-shrink: 0; }

/* 궤도 뱃지 */
.orbit-type-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
.orbit-type-badge.leo { background: rgba(52,211,153,0.15); color: var(--orbit-leo); }
.orbit-type-badge.meo { background: rgba(59,130,246,0.15); color: var(--orbit-meo); }
.orbit-type-badge.geo { background: rgba(245,158,11,0.15); color: var(--orbit-geo); }
.orbit-type-badge.heo { background: rgba(239,68,68,0.15); color: var(--orbit-heo); }

/* 상태 카드 */
.stat-cards { position: absolute; bottom: 16px; left: 16px; display: flex; gap: 8px; z-index: 10; }
.stat-card { padding: 10px 14px; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 80px; }
.stat-icon { color: var(--accent-light); }
.stat-icon.active { color: var(--status-active); }
.stat-value { font-size: 18px; font-weight: 700; color: var(--text-primary); }
.stat-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }

/* 상세 패널 */
.detail-panel { position: absolute; top: 16px; right: 16px; width: 300px; padding: 16px; z-index: 10; max-height: calc(100% - 100px); overflow-y: auto; }
.detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.detail-header h3 { font-size: 14px; font-weight: 700; color: var(--text-accent); flex: 1; }
.close-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; color: var(--text-muted); border-radius: var(--radius-sm); }
.close-btn:hover { color: var(--text-primary); background: var(--bg-elevated); }

.detail-section-title { font-size: 11px; font-weight: 700; color: var(--accent-light); text-transform: uppercase; letter-spacing: 0.3px; margin-top: 12px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(124,58,237,0.15); display: flex; align-items: center; gap: 4px; }
.observer-label { font-weight: 400; color: var(--text-muted); text-transform: none; font-size: 10px; }

.detail-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid rgba(124, 58, 237, 0.06); }
.detail-label { font-size: 11px; color: var(--text-muted); }
.detail-value { font-size: 11px; color: var(--text-primary); font-weight: 500; font-variant-numeric: tabular-nums; }
.detail-value.visible { color: var(--status-active); }
.detail-value.not-visible { color: var(--status-danger); }

.visibility-badge { padding: 1px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
.visibility-badge.yes { background: rgba(52,211,153,0.15); color: var(--status-active); }
.visibility-badge.no { background: rgba(239,68,68,0.1); color: var(--status-danger); }

/* 반응형 */
@media (max-width: 768px) {
  .orbit-legend { display: none; }
  .stat-cards { left: 8px; bottom: 80px; gap: 4px; }
  .stat-card { padding: 8px 10px; min-width: 65px; }
  .stat-value { font-size: 14px; }
  .detail-panel { top: auto; bottom: 80px; right: 8px; left: 8px; width: auto; max-height: 50%; }
}
</style>
