/**
 * @file SGP4 궤도 전파 엔진 (satellite.js 래퍼)
 * @project DanSat
 * @author Dangam Corp.
 *
 * TLE 데이터로부터 satellite.js를 사용하여 위성 위치(lat/lng/alt) 및
 * 궤도 경로를 계산한다.
 */

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  eciToEcf,
  ecfToLookAngles,
  degreesLong,
  degreesLat,
} from 'satellite.js';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;
const R_EARTH = 6371; // km
const AU_KM = 149597870.7; // 천문단위 (태양까지 거리)

// -----------------------------------------------------------------------------
// 저정밀 태양 위치 (ECI, km) — Jean Meeus "Astronomical Algorithms" ch.25 단순화판
// 0.01° 수준 정확. 가시성 판정(어두움/일조)에는 충분.
// -----------------------------------------------------------------------------
function sunPositionEci(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n  = jd - 2451545.0;
  const T  = n / 36525;

  // 평균 황경 / 평균 근점 이각 (deg)
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;

  // 황경 (deg) — 태양 방정식 반영
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  // 지구 궤도 이심률 근사
  const R = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AU_KM;

  // 황도경사각 (deg)
  const eps = (23.4393 - 0.0130 * T) * RAD;

  // 적도좌표계(J2000 ≈ ECI) 변환
  return {
    x: R * Math.cos(lambda),
    y: R * Math.cos(eps) * Math.sin(lambda),
    z: R * Math.sin(eps) * Math.sin(lambda),
  };
}

/**
 * 관측자 시점에서 태양이 지평선 아래 얼마나 있는지 (deg).
 * 음수일수록 밤에 가까움. 시민박명 기준 -6°, 천문박명 기준 -18°.
 */
function sunElevationAtObserver(observer, date) {
  const sun = sunPositionEci(date);
  const gmst = gstime(date);
  const sunEcf = eciToEcf(sun, gmst);
  const obsGd = {
    longitude: observer.lng * RAD,
    latitude:  observer.lat * RAD,
    height:    observer.alt || 0,
  };
  const la = ecfToLookAngles(obsGd, sunEcf);
  return la.elevation * DEG;
}

/**
 * 위성이 태양광에 비춰지고 있는지 (지구 그림자 밖에 있는지).
 * 원통형 본영(umbra) 근사: 태양 반대방향 투영이 R_earth 보다 멀면 조명됨.
 */
function isSunlit(satPosEci, date) {
  const sun = sunPositionEci(date);
  const sunMag = Math.hypot(sun.x, sun.y, sun.z);
  const sx = sun.x / sunMag, sy = sun.y / sunMag, sz = sun.z / sunMag; // 태양 방향 단위벡터

  // 위성 벡터를 태양 방향과 "태양 반대방향에 수직인 평면"으로 분해
  const dotSat = satPosEci.x * sx + satPosEci.y * sy + satPosEci.z * sz;

  // dotSat > 0 이면 태양 쪽 — 항상 조명됨
  if (dotSat > 0) return true;

  // 태양 반대편: 지구 축에서의 수직거리 계산
  const px = satPosEci.x - dotSat * sx;
  const py = satPosEci.y - dotSat * sy;
  const pz = satPosEci.z - dotSat * sz;
  const perp = Math.hypot(px, py, pz);

  // 수직거리가 지구 반경보다 크면 본영 바깥 → 조명
  return perp > R_EARTH;
}

/**
 * TLE 라인으로부터 satrec 객체 생성
 * @param {string} tleLine1
 * @param {string} tleLine2
 * @returns {Object} satrec
 */
function createSatrec(tleLine1, tleLine2) {
  return twoline2satrec(tleLine1, tleLine2);
}

/**
 * 특정 시각의 위성 위치 계산
 * @param {Object} satrec - satellite.js satrec 객체
 * @param {Date} date - 계산 시각
 * @returns {Object|null} { lat, lng, alt, speed, eciPosition, eciVelocity }
 */
function getPosition(satrec, date = new Date()) {
  const pv = propagate(satrec, date);
  if (!pv.position || typeof pv.position === 'boolean') return null;

  const gmst = gstime(date);
  const gd = eciToGeodetic(pv.position, gmst);

  const lat = degreesLat(gd.latitude);
  const lng = degreesLong(gd.longitude);
  const alt = gd.height; // km

  // 속도 계산 (km/s)
  const vel = pv.velocity;
  const speed = vel ? Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) : 0;

  return { lat, lng, alt, speed };
}

/**
 * 궤도 경로 좌표 계산 (앞으로 N분간)
 * @param {Object} satrec
 * @param {number} durationMin - 계산 기간 (분), 기본값 90 (LEO 1주기)
 * @param {number} stepSec - 계산 간격 (초), 기본값 30
 * @param {Date} startDate - 시작 시각
 * @returns {Array<Object>} [{ time, lat, lng, alt, speed }]
 */
function getOrbitPath(satrec, durationMin = 90, stepSec = 30, startDate = new Date()) {
  const path = [];
  const totalSteps = Math.ceil((durationMin * 60) / stepSec);

  for (let i = 0; i <= totalSteps; i++) {
    const t = new Date(startDate.getTime() + i * stepSec * 1000);
    const pos = getPosition(satrec, t);
    if (pos) {
      path.push({
        time: t.toISOString(),
        lat: pos.lat,
        lng: pos.lng,
        alt: pos.alt,
        speed: pos.speed,
      });
    }
  }

  return path;
}

/**
 * 관측자 위치에서의 Look Angles 계산
 * @param {Object} satrec
 * @param {Object} observer - { lat, lng, alt } (alt in km)
 * @param {Date} date
 * @returns {Object|null} { azimuth, elevation, rangeSat }
 */
function getLookAngles(satrec, observer, date = new Date()) {
  const pv = propagate(satrec, date);
  if (!pv.position || typeof pv.position === 'boolean') return null;

  const gmst = gstime(date);
  const obsGd = {
    longitude: observer.lng / DEG,
    latitude: observer.lat / DEG,
    height: observer.alt || 0,
  };

  const posEcf = eciToEcf(pv.position, gmst);
  const la = ecfToLookAngles(obsGd, posEcf);

  return {
    azimuth: la.azimuth * DEG,
    elevation: la.elevation * DEG,
    rangeSat: la.rangeSat,
  };
}

/**
 * 위성 패스 예측: 특정 위치에서 가시 시간대 계산
 *
 * 알고리즘:
 *   1) 30초 간격 coarse scan으로 상승/하강 edge 탐지
 *   2) edge 구간을 1초 정밀도로 binary-search bisect → 상승/하강 시각 오차 ±1초
 *   3) GEO 등 장시간 가시 위성의 패스 폭주를 막기 위해 maxPasses 상한 적용
 *
 * @param {Object} satrec
 * @param {Object} observer - { lat, lng, alt }
 * @param {number} hoursAhead - 앞으로 몇 시간 예측 (기본 24)
 * @param {number} minElevation - 최소 앙각 (기본 5°)
 * @param {number} maxPasses - 반환 패스 개수 상한 (기본 10, GEO 보호용)
 * @returns {Array<Object>} [{ riseTime, peakTime, setTime, peakElevation, peakAzimuth }]
 */
function predictPasses(satrec, observer, hoursAhead = 24, minElevation = 5, maxPasses = 10) {
  const COARSE_SEC = 30;
  const FINE_SEC = 1;
  const start = new Date();
  const end = new Date(start.getTime() + hoursAhead * 3600 * 1000);

  const laAt = (ms) => getLookAngles(satrec, observer, new Date(ms));

  /**
   * 특정 ms 시각에서 위성이 실제로 육안 관측 가능한지 계산.
   *   - sunElObserver: 관측자 기준 태양 고도 (deg) — -6° 이하 = 시민박명 이후 (어두움)
   *   - satSunlit:     위성이 지구 그림자 밖 (태양광 받음)
   *   - visible:       관측자 어둡고 + 위성 조명 + 앙각 > minElevation
   */
  const computeVisibility = (ms) => {
    const d = new Date(ms);
    const pv = propagate(satrec, d);
    if (!pv.position || typeof pv.position === 'boolean') {
      return { sunElObserver: null, satSunlit: false, visible: false };
    }
    const sunElObserver = sunElevationAtObserver(observer, d);
    const satSunlit = isSunlit(pv.position, d);
    return { sunElObserver, satSunlit };
  };

  /**
   * 두 샘플 사이의 threshold 교차 지점을 1초 정밀도로 bisect.
   * wantAbove=true  → 최초로 elevation > minElevation 이 되는 ms (rise)
   * wantAbove=false → 최초로 elevation <= minElevation 이 되는 ms (set)
   */
  const bisect = (t0Ms, t1Ms, wantAbove) => {
    let lo = t0Ms, hi = t1Ms;
    while (hi - lo > FINE_SEC * 1000) {
      const mid = Math.floor((lo + hi) / 2);
      const la = laAt(mid);
      const above = la ? (la.elevation > minElevation) : false;
      if (above === wantAbove) hi = mid;
      else lo = mid;
    }
    return hi;
  };

  const passes = [];
  let inPass = false;
  let currentPass = null;
  let prev = null; // { ms, elevation }

  for (let t = start.getTime(); t <= end.getTime(); t += COARSE_SEC * 1000) {
    const la = laAt(t);
    if (!la) { prev = null; continue; }
    const above = la.elevation > minElevation;

    // 상승 edge: 직전에 below였고 현재 above
    if (above && !inPass) {
      const riseMs = prev ? bisect(prev.ms, t, true) : t;
      const laRise = laAt(riseMs) || la;
      inPass = true;
      currentPass = {
        riseTime: new Date(riseMs).toISOString(),
        peakTime: new Date(riseMs).toISOString(),
        setTime: null,
        peakElevation: laRise.elevation,
        peakAzimuth: laRise.azimuth,
      };
    }

    // 패스 도중: peak 갱신 (coarse 30초 해상도 — rise/set 정밀도가 우선)
    if (above && inPass && la.elevation > currentPass.peakElevation) {
      currentPass.peakElevation = la.elevation;
      currentPass.peakAzimuth = la.azimuth;
      currentPass.peakTime = new Date(t).toISOString();
    }

    // 하강 edge: 직전에 above였고 현재 below
    if (!above && inPass) {
      const setMs = prev ? bisect(prev.ms, t, false) : t;
      currentPass.setTime = new Date(setMs).toISOString();
      currentPass.peakElevation = Math.round(currentPass.peakElevation * 100) / 100;
      currentPass.peakAzimuth = Math.round(currentPass.peakAzimuth * 100) / 100;

      // peak 시각에 육안 관측 가능 여부 계산 (옵션이지만 거의 무료 — 한 번 더 propagate)
      const peakMs = new Date(currentPass.peakTime).getTime();
      const vis = computeVisibility(peakMs);
      currentPass.sunElObserver = vis.sunElObserver != null
        ? Math.round(vis.sunElObserver * 10) / 10
        : null;
      currentPass.satSunlit     = vis.satSunlit;
      // 육안 관측 가능: 관측자 어두움 (시민박명 -6° 이하) + 위성이 태양광 받음
      currentPass.visible = (vis.sunElObserver != null && vis.sunElObserver < -6)
                         && vis.satSunlit;

      passes.push({ ...currentPass });
      inPass = false;
      currentPass = null;
      if (passes.length >= maxPasses) break;
    }

    prev = { ms: t, elevation: la.elevation };
  }

  // 윈도우 끝까지 패스 진행 중이면 end 시각으로 종료 처리 (GEO 등)
  if (inPass && currentPass) {
    currentPass.setTime = end.toISOString();
    currentPass.peakElevation = Math.round(currentPass.peakElevation * 100) / 100;
    currentPass.peakAzimuth = Math.round(currentPass.peakAzimuth * 100) / 100;

    const peakMs = new Date(currentPass.peakTime).getTime();
    const vis = computeVisibility(peakMs);
    currentPass.sunElObserver = vis.sunElObserver != null
      ? Math.round(vis.sunElObserver * 10) / 10
      : null;
    currentPass.satSunlit = vis.satSunlit;
    currentPass.visible = (vis.sunElObserver != null && vis.sunElObserver < -6)
                       && vis.satSunlit;

    passes.push({ ...currentPass });
  }

  return passes.slice(0, maxPasses);
}

export {
  createSatrec,
  getPosition,
  getOrbitPath,
  getLookAngles,
  predictPasses,
  // 가시성 보조 유틸 (라우트/테스트에서 직접 호출 가능)
  sunPositionEci,
  sunElevationAtObserver,
  isSunlit,
};
