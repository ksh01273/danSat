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
const R_EARTH = 6371; // km

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
 * @param {Object} satrec
 * @param {Object} observer - { lat, lng, alt }
 * @param {number} hoursAhead - 앞으로 몇 시간 예측 (기본 24)
 * @param {number} minElevation - 최소 앙각 (기본 5°)
 * @returns {Array<Object>} [{ riseTime, peakTime, setTime, peakElevation, peakAzimuth }]
 */
function predictPasses(satrec, observer, hoursAhead = 24, minElevation = 5) {
  const passes = [];
  const stepSec = 30; // 30초 간격 스캔
  const start = new Date();
  const end = new Date(start.getTime() + hoursAhead * 3600 * 1000);

  let inPass = false;
  let currentPass = { riseTime: null, peakTime: null, setTime: null, peakElevation: -90, peakAzimuth: 0 };

  for (let t = start.getTime(); t <= end.getTime(); t += stepSec * 1000) {
    const date = new Date(t);
    const la = getLookAngles(satrec, observer, date);
    if (!la) continue;

    if (la.elevation > minElevation) {
      if (!inPass) {
        // 패스 시작
        inPass = true;
        currentPass = {
          riseTime: date.toISOString(),
          peakTime: date.toISOString(),
          setTime: null,
          peakElevation: la.elevation,
          peakAzimuth: la.azimuth,
        };
      }
      if (la.elevation > currentPass.peakElevation) {
        currentPass.peakElevation = la.elevation;
        currentPass.peakAzimuth = la.azimuth;
        currentPass.peakTime = date.toISOString();
      }
    } else {
      if (inPass) {
        // 패스 종료
        currentPass.setTime = date.toISOString();
        currentPass.peakElevation = Math.round(currentPass.peakElevation * 100) / 100;
        currentPass.peakAzimuth = Math.round(currentPass.peakAzimuth * 100) / 100;
        passes.push({ ...currentPass });
        inPass = false;
      }
    }
  }

  return passes;
}

export { createSatrec, getPosition, getOrbitPath, getLookAngles, predictPasses };
