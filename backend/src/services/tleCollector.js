/**
 * @file TLE 데이터 수집기 — CelesTrak GP API → dancollect.satellite.tle_data
 * @project DanSat
 * @author Dangam Corp.
 *
 * CelesTrak에서 카테고리별 TLE 데이터를 가져와 dancollect DB의
 * satellite.tle_data 테이블에 UPSERT 한다.
 * (2026-04-22 migration 012 로 dansat.tle_data → satellite.tle_data 스키마 cutover 완료.
 *  이 수동 트리거 경로도 정규 테이블로 일치화 — 2026-04-24 `dansat-20260424-01`.)
 *
 * 수집 주기: 1일 2회 (cron 06:00, 18:00 KST) — 실제로는 dancollect-daemon 의
 * `satellite.tle_data.daily` 잡이 스케줄 수집을 담당하고, 본 파일의 POST
 * `/api/satellites/collect/run` 은 수동 긴급 트리거 용도로만 남겨둠.
 *
 * 사용법:
 *   node src/services/tleCollector.js          # 단독 실행 (1회 수집)
 *   (PM2 cron 또는 daemon에서 호출)
 */

import { collectPool } from './db.js';

const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

// 수집 대상 카테고리 (주요 카테고리)
const COLLECT_CATEGORIES = [
  { group: 'stations', category: 'stations' },
  { group: 'starlink', category: 'starlink' },
  { group: 'weather', category: 'weather' },
  { group: 'gps-ops', category: 'navigation' },
  { group: 'science', category: 'science' },
  { group: 'resource', category: 'earth-observation' },
  { group: 'active', category: 'active' },
  { group: 'analyst', category: 'analyst' },
];

/**
 * TLE epoch 파싱: 2자리 연도 + day-of-year 소수점
 * 예: "24001.50000000" → 2024-01-01T12:00:00Z
 */
function parseTleEpoch(line1) {
  try {
    const epochStr = line1.substring(18, 32).trim();
    let year = parseInt(epochStr.substring(0, 2), 10);
    year = year >= 57 ? 1900 + year : 2000 + year;
    const dayOfYear = parseFloat(epochStr.substring(2));
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const epochMs = jan1.getTime() + (dayOfYear - 1) * 86400000;
    return new Date(epochMs);
  } catch {
    return null;
  }
}

/**
 * 3-line TLE 텍스트를 JSON 배열로 파싱
 */
function parseTleText(text) {
  const lines = text.trim().split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length > 0);
  const results = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;

    const noradId = parseInt(line1.substring(2, 7).trim(), 10);
    const classification = line1.charAt(7) || 'U';
    const meanMotion = parseFloat(line2.substring(52, 63).trim());
    const inclination = parseFloat(line2.substring(8, 16).trim());
    const eccentricity = parseFloat('0.' + line2.substring(26, 33).trim());
    const raOfAscNode = parseFloat(line2.substring(17, 25).trim());
    const argOfPericenter = parseFloat(line2.substring(34, 42).trim());
    const meanAnomaly = parseFloat(line2.substring(43, 51).trim());
    const epoch = parseTleEpoch(line1);

    results.push({
      noradId,
      name,
      tleLine1: line1,
      tleLine2: line2,
      epoch,
      classification,
      inclination,
      eccentricity,
      meanMotion,
      raOfAscNode,
      argOfPericenter,
      meanAnomaly,
    });
  }

  return results;
}

/**
 * CelesTrak에서 TLE 데이터 fetch
 */
async function fetchTle(group) {
  const url = `${CELESTRAK_BASE}?GROUP=${group}&FORMAT=tle`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'DanSat-Collector/1.0 (dangamcorp.co.kr)' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`CelesTrak HTTP ${response.status} for group=${group}`);
  }

  const text = await response.text();
  // CelesTrak은 에러를 텍스트로 반환하는 경우가 있음
  if (text.includes('No GP data found') || text.length < 50) {
    return [];
  }

  return parseTleText(text);
}

/**
 * DB에 UPSERT (norad_id + tle_line1 UNIQUE)
 */
async function upsertTleData(records, category) {
  if (!records.length) return 0;

  const client = await collectPool.connect();
  let inserted = 0;

  try {
    await client.query('BEGIN');

    // 2026-04-22 migration 012 cutover: dansat.tle_data → satellite.tle_data
    const stmt = `
      INSERT INTO satellite.tle_data
        (norad_id, name, tle_line1, tle_line2, epoch, classification,
         inclination, eccentricity, mean_motion, ra_of_asc_node,
         arg_of_pericenter, mean_anomaly, category, collected_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (norad_id, tle_line1)
      DO UPDATE SET
        name = EXCLUDED.name,
        epoch = EXCLUDED.epoch,
        collected_at = NOW()
    `;

    for (const r of records) {
      await client.query(stmt, [
        r.noradId, r.name, r.tleLine1, r.tleLine2,
        r.epoch, r.classification,
        r.inclination, r.eccentricity, r.meanMotion,
        r.raOfAscNode, r.argOfPericenter, r.meanAnomaly,
        category,
      ]);
      inserted++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return inserted;
}

/**
 * 전체 카테고리 수집 실행
 */
async function collectAll() {
  console.log(`[TLE Collector] 수집 시작: ${new Date().toISOString()}`);
  let totalInserted = 0;
  let totalFetched = 0;

  for (const { group, category } of COLLECT_CATEGORIES) {
    try {
      const records = await fetchTle(group);
      totalFetched += records.length;

      if (records.length > 0) {
        const count = await upsertTleData(records, category);
        totalInserted += count;
        console.log(`  [${category}] ${records.length}건 fetch → ${count}건 upsert`);
      } else {
        console.log(`  [${category}] 데이터 없음`);
      }

      // CelesTrak rate limit 방지: 카테고리 간 2초 대기
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  [${category}] 에러:`, err.message);
    }
  }

  console.log(`[TLE Collector] 완료: ${totalFetched}건 fetch, ${totalInserted}건 upsert`);
  return { totalFetched, totalInserted };
}

// 단독 실행 시
const isMain = process.argv[1]?.endsWith('tleCollector.js');
if (isMain) {
  collectAll()
    .then((result) => {
      console.log('[TLE Collector] 결과:', JSON.stringify(result));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[TLE Collector] 치명적 에러:', err);
      process.exit(1);
    });
}

export { collectAll, fetchTle, parseTleText };
