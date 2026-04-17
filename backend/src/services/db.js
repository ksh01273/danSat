/**
 * @file PostgreSQL 데이터베이스 연결 풀
 * @project DanSat
 * @author Dangam Corp.
 *
 * 서비스 DB(dansat)와 수집 DB(dancollect) 두 가지 풀 제공.
 * - servicePool: dansat DB (서비스 전용 데이터)
 * - collectPool: dancollect DB (TLE 수집 데이터, dansat 스키마)
 */

import pg from 'pg';
const { Pool } = pg;

// 서비스 DB (dansat)
const servicePool = new Pool({
  host: process.env.DB_HOST || '192.168.10.55',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dansat',
  user: process.env.DB_USER || 'dangam_mcp_user',
  password: process.env.DB_PASSWORD || 'dangam1004!@',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 수집 DB (dancollect.dansat 스키마)
const collectPool = new Pool({
  host: process.env.COLLECT_DB_HOST || process.env.DB_HOST || '192.168.10.55',
  port: parseInt(process.env.COLLECT_DB_PORT || process.env.DB_PORT || '5432'),
  database: process.env.COLLECT_DB_NAME || 'dancollect',
  user: process.env.DB_USER || 'dangam_mcp_user',
  password: process.env.DB_PASSWORD || 'dangam1004!@',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 연결 테스트
servicePool.on('error', (err) => {
  console.error('[DB] servicePool 에러:', err.message);
});

collectPool.on('error', (err) => {
  console.error('[DB] collectPool 에러:', err.message);
});

export { servicePool, collectPool };
