/**
 * @file 위성 데이터 API 라우트
 * @project DanSat
 * @author Dangam Corp.
 *
 * CelesTrak에서 TLE(3-line) 형식을 가져와 파싱 후 JSON 반환.
 * GP JSON 형식에는 TLE_LINE1/2가 없어서 satellite.js와 호환이 안 되므로
 * TLE 텍스트를 직접 파싱하여 궤도 요소 + TLE 라인을 함께 제공한다.
 */

import { Router } from 'express';

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
    const url = `${CELESTRAK_BASE}?GROUP=${group}&FORMAT=tle`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'DanSat/1.0 (dangamcorp.co.kr)' }
    });

    if (!response.ok) {
      throw new Error(`CelesTrak 응답 오류: ${response.status}`);
    }

    const text = await response.text();
    const data = parseTleText(text);

    res.json({ success: true, data, count: data.length });
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

    const url = `${CELESTRAK_BASE}?NAME=${encodeURIComponent(q)}&FORMAT=tle`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DanSat/1.0 (dangamcorp.co.kr)' }
    });

    if (!response.ok) {
      throw new Error(`CelesTrak 검색 오류: ${response.status}`);
    }

    const text = await response.text();
    const data = parseTleText(text);
    const limited = data.slice(0, 50);

    res.json({ success: true, data: limited, count: limited.length });
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
    const url = `${CELESTRAK_BASE}?CATNR=${id}&FORMAT=tle`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'DanSat/1.0 (dangamcorp.co.kr)' }
    });

    if (!response.ok) {
      throw new Error(`CelesTrak NORAD 조회 오류: ${response.status}`);
    }

    const text = await response.text();
    const data = parseTleText(text);

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `NORAD ID ${id}에 해당하는 위성을 찾을 수 없습니다` }
      });
    }

    res.json({ success: true, data: data[0] });
  } catch (err) {
    console.error('[NORAD Fetch Error]', err.message);
    res.status(502).json({
      success: false,
      error: { code: 'NORAD_FETCH_ERROR', message: '위성 데이터를 가져올 수 없습니다' }
    });
  }
});

export default router;
