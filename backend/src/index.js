/**
 * @file DanSat 백엔드 API 서버 진입점
 * @project DanSat
 * @author Dangam Corp.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 환경변수 로드
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
dotenv.config({ path: path.join(__dirname, '..', envFile) });

// [방어1] 필수 환경변수 검증
const required = ['PORT', 'DB_HOST', 'DB_NAME'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[FATAL] 필수 환경변수 누락: ${missing.join(', ')}`);
  console.error('[INFO] .env 파일을 확인하세요. 30초 후 재시도...');
  setInterval(() => {
    console.error('[WAITING] 환경변수 대기 중...');
  }, 30000);
} else {
  startServer();
}

async function startServer() {
  const express = (await import('express')).default;
  const cors = (await import('cors')).default;

  const app = express();
  const PORT = process.env.PORT || 3009;

  // 미들웨어
  app.use(cors());
  app.use(express.json());

  // 라우트 등록
  const satelliteRoutes = (await import('./routes/satellites.js')).default;
  app.use('/api/satellites', satelliteRoutes);

  // 헬스체크
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'dansat-api',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }
    });
  });

  // 404
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '요청한 API를 찾을 수 없습니다' }
    });
  });

  // 전역 에러 핸들러
  app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다' }
    });
  });

  app.listen(PORT, () => {
    console.log(`[DanSat API] 서버 시작 - 포트 ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  // [방어4] 전역 에러 핸들러
  process.on('uncaughtException', (err) => {
    console.error('[FATAL] uncaughtException:', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] unhandledRejection:', reason);
  });
}
