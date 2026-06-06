// src/lib/db.ts
// ไคลเอนต์ Drizzle ORM singleton สำหรับ Next.js
// รองรับการแยกอ่านและเขียน (Read-Write Splitting) ผ่าน Drizzle's native withReplicas

import { drizzle } from 'drizzle-orm/node-postgres';
import { withReplicas } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from '../db/schema';

const primaryConnectionString = process.env.DATABASE_URL!;
const replicaConnectionString = process.env.DATABASE_READ_URL;

function createDrizzleInstance() {
  if (!primaryConnectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  // 1. สร้าง Pool เชื่อมต่อฐานข้อมูลหลัก (Write operations)
  const primaryPool = new Pool({
    connectionString: primaryConnectionString,
    max: parseInt(process.env.DB_POOL_MAX || '5'),
    min: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  });
  
  const primaryDb = drizzle(primaryPool, { schema });

  // 2. ถ้ามี DATABASE_READ_URL และไม่ตรงกับ Primary ให้เปิดใช้งาน Read Replica (Read operations)
  if (replicaConnectionString && replicaConnectionString !== primaryConnectionString) {
    const replicaPool = new Pool({
      connectionString: replicaConnectionString,
      max: parseInt(process.env.DB_POOL_MAX || '5'),
      min: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      keepAlive: true,
    });
    
    const replicaDb = drizzle(replicaPool, { schema });
    
    console.log('⚖️ เปิดใช้งาน Drizzle Read Replicas (Load Balancing) เรียบร้อยแล้ว');
    return withReplicas(primaryDb, [replicaDb]);
  }
  
  console.log('🔌 เชื่อมต่อฐานข้อมูลหลัก (Primary DB เท่านั้น)');
  return primaryDb;
}

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof createDrizzleInstance> | undefined;
};

export const db = globalForDb.db ?? createDrizzleInstance();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}
