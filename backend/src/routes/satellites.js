/**
 * @file 위성 데이터 API 라우트
 * @project DanSat
 * @author Dangam Corp.
 *
 * CelesTrak에서 TLE(3-line) 형식을 가져와 파싱 후 JSON 반환.
 * SGP4 궤도 전파 엔진을 통한 위성 위치/궤도 계산 API 제공.
 */

import { Router } from 'express';
import { createSatrec, getPosition, getOrbitPath, getLookAngles, predictPasses } from '../services/sgp4.js';
import { collectPool } from '../services/db.js';

const router = Router();

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

/**
 * 위성 카테고리 목록
 */
const CATEGORIES = [
  { id: 'stations', name: '우주정거장', query: 'GROUP=stations', icon: 'building' },
  { id: 'starlink', name: 'Starlink', query: 'GROUP=starlink', icon: 'wifi' },
  { id: 'weather', name: '기상위성', query: 'GROUP=weather', icon: 'cloud' },
  { id: 'navigation', name: '항법위성 (GPS 등)', query: 'GROUP=gps-ops', icon: 'navigation' },
  { id: 'science', name: '과학위성', query: 'GROUP=science', icon: 'microscope' },
  { id: 'earth-observation', name: '지구관측', query: 'GROUP=resource', icon: 'globe' },
];

/**
 * 3-line TLE 텍스트를 JSON 배열로 파싱
 * @param {string} text - CelesTrak TLE 응답 텍스트
 * @returns {Array} 위성 객체 배열
 */
function parseTleText(text) {
  const lines = text.trim().split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length > 0);
  const results = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    // TLE 유효성 검증
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;

    const noradId = parseInt(line1.substring(2, 7).trim(), 10);
    const meanMotion = parseFloat(line2.substring(52, 63).trim());
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const eccentricity = parseFloat('0.' + line2.substring(26, 33).trim());
    const raOfAscNode = parseFloat(line2.substring(17, 25).trim());
    const argOfPericenter = parseFloat(line2.substring(34, 42).trim());
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim());

    results.push({
      OBJECT_NAME: name,
      NORAD_CAT_ID: noradId,
      TLE_LINE1: line1,
      TLE_LINE2: line2,
      MEAN_MOTION: meanMotion,
      INCLINATION: inclination,
      ECCENTRICITY: eccentricity,
      RA_OF_ASC_NODE: raOfAscNode,
      ARG_OF_PERICENTER: argOfPericenter,
      MEAN_ANOMALY: meanAnomaly,
    });
  }

  return results;
}

/**
 * CelesTrak에서 TLE 가져오기 (내부 헬퍼)
 */
async function fetchCelestrakTle(params) {
  const url = `${CELESTRAK_BASE}?${params}&FORMAT=tle`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'DanSat/1.0 (dangamcorp.co.kr)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`CelesTrak HTTP ${response.status}`);
  const text = await response.text();
  return parseTleText(text);
}

/**
 * DB(dancollect.satellite.tle_data)에서 TLE 행을 CelesTrak 응답 포맷으로 반환 (내부 헬퍼)
 * 2026-04-22: migration 012 로 dansat.tle_data → satellite.tle_data 스키마 cutover 완료.
 * @param {Object} opts
 * @param {number} [opts.noradId]  — 단일 NORAD ID 조회 (norad_id = X)
 * @param {string} [opts.nameQuery] — 이름 LIKE 검색 (대소문자 무시, 공백 제거)
 * @param {string} [opts.category]  — category 컬럼 (group=stations/starlink/...)
 * @param {number} [opts.limit]     — 결과 개수 제한 (기본 200, search 경로에서 50으로 덮어쓰기)
 * @returns {Promise<Array>}        — CelesTrak parseTleText() 와 동일 스키마 배열
 */
async function getTleFromDb({ noradId, nameQuery, category, limit = 200 } = {}) {
  const where = [];
  const params = [];
  let p = 0;

  if (noradId !== undefined && noradId !== null && !isNaN(noradId)) {
    params.push(parseInt(noradId, 10));
    where.push(`norad_id = $${++p}`);
  }
  if (nameQuery) {
    params.push(`%${nameQuery.trim()}%`);
    where.push(`UPPER(name) LIKE UPPER($${++p})`);
  }
  if (category) {
    params.push(category);
    where.push(`category = $${++p}`);
  }

  if (where.length === 0) return [];

  // norad_id 별 최신 TLE 1건(DISTINCT ON) + limit
  params.push(limit);
  const sql = `
    SELECT DISTINCT ON (norad_id)
      norad_id, name, tle_line1, tle_line2,
      mean_motion, inclination, eccentricity,
      ra_of_asc_node, arg_of_pericenter, mean_anomaly
    FROM satellite.tle_data
    WHERE ${where.join(' AND ')}
    ORDER BY norad_id, epoch DESC NULLS LAST, collected_at DESC
    LIMIT $${++p}
  `;

  const result = await collectPool.query(sql, params);
  return result.rows.map(r => ({
    OBJECT_NAME: r.name,
    NORAD_CAT_ID: r.norad_id,
    TLE_LINE1: r.tle_line1,
    TLE_LINE2: r.tle_line2,
    MEAN_MOTION: r.mean_motion !== null ? Number(r.mean_motion) : null,
    INCLINATION: r.inclination !== null ? Number(r.inclination) : null,
    ECCENTRICITY: r.eccentricity !== null ? Number(r.eccentricity) : null,
    RA_OF_ASC_NODE: r.ra_of_asc_node !== null ? Number(r.ra_of_asc_node) : null,
    ARG_OF_PERICENTER: r.arg_of_pericenter !== null ? Number(r.arg_of_pericenter) : null,
    MEAN_ANOMALY: r.mean_anomaly !== null ? Number(r.mean_anomaly) : null,
  }));
}

/**
 * DB 우선 검색 후 결과 없으면 CelesTrak fallback (내부 헬퍼)
 * 응답 포맷은 CelesTrak parseTleText() 와 동일
 * @param {Object} opts  — getTleFromDb() 와 동일 + celestrakParams (fallback 용)
 * @param {string} opts.celestrakParams — CATNR=123 / NAME=ISS / GROUP=stations 등
 * @returns {Promise<{data: Array, source: 'db'|'celestrak'}>}
 */
async function fetchTleWithDbFirst(opts) {
  try {
    const dbRows = await getTleFromDb(opts);
    if (dbRows.length > 0) {
      return { data: dbRows, source: 'db' };
    }
  } catch (err) {
    // DB 장애 시 CelesTrak 으로 graceful degrade
    console.warn('[TLE DB lookup failed, fallback to CelesTrak]', err.message);
  }
  const live = await fetchCelestrakTle(opts.celestrakParams);
  return { data: live, source: 'celestrak' };
}

// ======================
//  기존 API
// ======================

/**
 * GET /api/satellites/categories
 */
router.get('/categories', (req, res) => {
  res.json({ success: true, data: CATEGORIES });
});

/**
 * GET /api/satellites/tle?group=stations
 * CelesTrak에서 TLE 데이터를 가져와 JSON으로 반환
 */
router.get('/tle', async (req, res) => {
  try {
    const { group = 'stations' } = req.query;
    // DB 우선 — category 컬럼에 수집 시 GROUP 값이 그대로 저장돼 있음
    const { data, source } = await fetchTleWithDbFirst({
      category: group,
      limit: 500,
      celestrakParams: `GROUP=${group}`,
    });
    res.json({ success: true, data, count: data.length, source });
  } catch (err) {
    console.error('[TLE Fetch Error]', err.message);
    res.status(502).json({
      success: false,
      error: { code: 'TLE_FETCH_ERROR', message: 'CelesTrak 데이터를 가져올 수 없습니다' }
    });
  }
});

/**
 * GET /api/satellites/search?q=ISS
 * 위성 이름 검색
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QUERY', message: '검색어는 2자 이상이어야 합니다' }
      });
    }

    // DB 우선 — name ILIKE %q% 로 검색 후 결과 0건 시 CelesTrak NAME= 로 fallback
    const { data, source } = await fetchTleWithDbFirst({
      nameQuery: q,
      limit: 50,
      celestrakParams: `NAME=${encodeURIComponent(q)}`,
    });
    const limited = data.slice(0, 50);
    res.json({ success: true, data: limited, count: limited.length, source });
  } catch (err) {
    console.error('[Search Error]', err.message);
    res.status(502).json({
      success: false,
      error: { code: 'SEARCH_ERROR', message: '위성 검색 중 오류가 발생했습니다' }
    });
  }
});

/**
 * GET /api/satellites/norad/:id
 * NORAD ID로 단일 위성 조회
 */
router.get('/norad/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // DB 우선 — norad_id 정확 매칭 → 없을 때만 CelesTrak CATNR=
    const { data, source } = await fetchTleWithDbFirst({
      noradId: id,
      limit: 1,
      celestrakParams: `CATNR=${id}`,
    });

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `NORAD ID ${id}에 해당하는 위성을 찾을 수 없습니다` }
      });
    }

    res.json({ success: true, data: data[0], source });
  } catch (err) {
    console.error('[NORAD Fetch Error]', err.message);
    res.status(502).json({
      success: false,
      error: { code: 'NORAD_FETCH_ERROR', message: '위성 데이터를 가져올 수 없습니다' }
    });
  }
});

// ======================
//  SGP4 궤도 전파 API (신규)
// ======================

/**
 * GET /api/satellites/:noradId/position
 * 위성의 현재 위치(lat/lng/alt/speed) 실시간 계산
 *
 * Query params:
 *   - time (optional): ISO 8601 시각. 기본값 = 현재
 */
router.get('/:noradId/position', async (req, res) => {
  try {
    const { noradId } = req.params;
    const time = req.query.time ? new Date(req.query.time) : new Date();

    // DB 우선 (일일 수집 TLE) → 미수집이면 CelesTrak CATNR=
    const { data } = await fetchTleWithDbFirst({
      noradId,
      limit: 1,
      celestrakParams: `CATNR=${noradId}`,
    });
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `NORAD ID ${noradId} 위성을 찾을 수 없습니다` }
      });
    }

    const sat = data[0];
    const satrec = createSatrec(sat.TLE_LINE1, sat.TLE_LINE2);
    const pos = getPosition(satrec, time);

    if (!pos) {
      return res.status(500).json({
        success: false,
        error: { code: 'PROPAGATION_ERROR', message: 'SGP4 궤도 전파 실패' }
      });
    }

    res.json({
      success: true,
      data: {
        noradId: parseInt(noradId),
        name: sat.OBJECT_NAME,
        time: time.toISOString(),
        position: {
          lat: Math.round(pos.lat * 10000) / 10000,
          lng: Math.round(pos.lng * 10000) / 10000,
          alt: Math.round(pos.alt * 10) / 10,
          speed: Math.round(pos.speed * 1000) / 1000,
        }
      }
    });
  } catch (err) {
    console.error('[Position Error]', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'POSITION_ERROR', message: '위성 위치 계산 중 오류가 발생했습니다' }
    });
  }
});

/**
 * GET /api/satellites/:noradId/orbit
 * 궤도 경로 계산 (다음 N분간 경로 좌표 배열)
 *
 * Query params:
 *   - duration (optional): 분 단위, 기본 90분 (LEO 1주기), 최대 180분
 *   - step (optional): 초 단위, 기본 30초, 최소 10초
 */
router.get('/:noradId/orbit', async (req, res) => {
  try {
    const { noradId } = req.params;
    const duration = Math.min(parseInt(req.query.duration || '90'), 180);
    const step = Math.max(parseInt(req.query.step || '30'), 10);

    const { data } = await fetchTleWithDbFirst({
      noradId,
      limit: 1,
      celestrakParams: `CATNR=${noradId}`,
    });
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `NORAD ID ${noradId} 위성을 찾을 수 없습니다` }
      });
    }

    const sat = data[0];
    const satrec = createSatrec(sat.TLE_LINE1, sat.TLE_LINE2);
    const path = getOrbitPath(satrec, duration, step);

    res.json({
      success: true,
      data: {
        noradId: parseInt(noradId),
        name: sat.OBJECT_NAME,
        duration,
        step,
        points: path.length,
        path,
      }
    });
  } catch (err) {
    console.error('[Orbit Error]', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'ORBIT_ERROR', message: '궤도 경로 계산 중 오류가 발생했습니다' }
    });
  }
});

/**
 * GET /api/satellites/:noradId/passes
 * 위성 패스 예측 (특정 관측 위치에서 가시 시간대)
 *
 * Query params:
 *   - lat (required): 관측자 위도
 *   - lng (required): 관측자 경도
 *   - alt (optional): 관측자 고도 (km), 기본 0
 *   - hours (optional): 예측 시간, 기본 24, 최대 72
 *   - minEl (optional): 최소 앙각, 기본 5°
 */
router.get('/:noradId/passes', async (req, res) => {
  try {
    const { noradId } = req.params;
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'lat, lng 파라미터가 필요합니다' }
      });
    }

    const alt = parseFloat(req.query.alt || '0');
    const hours = Math.min(parseInt(req.query.hours || '24'), 72);
    const minEl = parseFloat(req.query.minEl || '5');
    const maxPasses = Math.min(Math.max(parseInt(req.query.maxPasses || '10'), 1), 50);

    const { data } = await fetchTleWithDbFirst({
      noradId,
      limit: 1,
      celestrakParams: `CATNR=${noradId}`,
    });
    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `NORAD ID ${noradId} 위성을 찾을 수 없습니다` }
      });
    }

    const sat = data[0];
    const satrec = createSatrec(sat.TLE_LINE1, sat.TLE_LINE2);
    const passes = predictPasses(satrec, { lat, lng, alt }, hours, minEl, maxPasses);

    res.json({
      success: true,
      data: {
        noradId: parseInt(noradId),
        name: sat.OBJECT_NAME,
        observer: { lat, lng, alt },
        hoursAhead: hours,
        minElevation: minEl,
        maxPasses,
        passes,
        count: passes.length,
      }
    });
  } catch (err) {
    console.error('[Passes Error]', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'PASSES_ERROR', message: '패스 예측 중 오류가 발생했습니다' }
    });
  }
});

/**
 * GET /api/satellites/collect/status
 * 수집 DB(dancollect.satellite.tle_data) 상태 조회
 */
router.get('/collect/status', async (req, res) => {
  try {
    const result = await collectPool.query(`
      SELECT
        category,
        COUNT(*) as count,
        MAX(collected_at) as last_collected,
        MAX(epoch) as latest_epoch
      FROM satellite.tle_data
      GROUP BY category
      ORDER BY category
    `);

    const totalResult = await collectPool.query('SELECT COUNT(*) as total FROM satellite.tle_data');

    res.json({
      success: true,
      data: {
        total: parseInt(totalResult.rows[0].total),
        categories: result.rows,
      }
    });
  } catch (err) {
    console.error('[Collect Status Error]', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'DB_ERROR', message: '수집 상태 조회 중 오류가 발생했습니다' }
    });
  }
});

/**
 * POST /api/satellites/collect/run
 * 수동 TLE 수집 트리거 (관리자용)
 */
router.post('/collect/run', async (req, res) => {
  try {
    const { collectAll } = await import('../services/tleCollector.js');
    // 비동기로 수집 시작 (응답은 먼저 반환)
    const result = await collectAll();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Collect Run Error]', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'COLLECT_ERROR', message: 'TLE 수집 중 오류가 발생했습니다' }
    });
  }
});

export default router;
