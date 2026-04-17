/**
 * @file TLE 수집 데몬 — cron 스케줄러
 * @project DanSat
 * @author Dangam Corp.
 *
 * PM2로 실행: pm2 start src/services/daemon.js --name dansat-collector
 * 수집 주기: 매일 06:00, 18:00 KST (= 21:00, 09:00 UTC)
 */

import { collectAll } from './tleCollector.js';

const COLLECT_HOURS_UTC = [21, 9]; // KST 06:00 = UTC 21:00, KST 18:00 = UTC 09:00
let lastCollectHour = -1;

async function checkAndCollect() {
  const now = new Date();
  const hour = now.getUTCHours();

  if (COLLECT_HOURS_UTC.includes(hour) && lastCollectHour !== hour) {
    lastCollectHour = hour;
    console.log(`[Daemon] 수집 트리거: UTC ${hour}시`);
    try {
      await collectAll();
    } catch (err) {
      console.error('[Daemon] 수집 에러:', err.message);
    }
  }
}

// 시작 시 즉시 1회 수집
console.log('[Daemon] DanSat TLE 수집 데몬 시작');
collectAll().catch(err => console.error('[Daemon] 초기 수집 에러:', err.message));

// 매 10분마다 스케줄 체크
setInterval(checkAndCollect, 10 * 60 * 1000);

// 프로세스 종료 방지
process.on('uncaughtException', (err) => {
  console.error('[Daemon] uncaughtException:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Daemon] unhandledRejection:', reason);
});
