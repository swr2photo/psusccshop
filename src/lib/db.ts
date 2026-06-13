// src/lib/db.ts
// ไคลเอนต์ Drizzle ORM singleton สำหรับ Next.js
// รองรับการแยกอ่านและเขียน (Read-Write Splitting) ผ่าน Drizzle's native withReplicas

import { drizzle } from 'drizzle-orm/node-postgres';
import { withReplicas } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from '../db/schema';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';

function resolvePrimaryConnectionString(): string {
  const cf = (globalThis as { __CF_ENV__?: { HYPERDRIVE?: { connectionString: string } } }).__CF_ENV__;
  if (cf?.HYPERDRIVE?.connectionString) {
    return cf.HYPERDRIVE.connectionString;
  }
  const primaryConnectionString = process.env.DATABASE_URL;
  if (!primaryConnectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }
  return primaryConnectionString;
}

function createDrizzleInstance() {
  const primaryConnectionString = resolvePrimaryConnectionString();
  const replicaConnectionString = process.env.DATABASE_READ_URL;
  const onWorkers = isCloudflareWorkersRuntime();

  // Workers isolates: single short-lived connection via Hyperdrive (avoid pool crashes)
  const poolMax = onWorkers ? 1 : parseInt(process.env.DB_POOL_MAX || '5');
  const poolMin = onWorkers ? 0 : 1;

  // 1. สร้าง Pool เชื่อมต่อฐานข้อมูลหลัก (Write operations)
  const primaryPool = new Pool({
    connectionString: primaryConnectionString,
    max: poolMax,
    min: poolMin,
    idleTimeoutMillis: onWorkers ? 10_000 : 30_000,
    connectionTimeoutMillis: onWorkers ? 10_000 : 5_000,
    keepAlive: !onWorkers,
  });
  
  const primaryDb = drizzle(primaryPool, { schema });

  // 2. Read replica — skip on Workers (Hyperdrive binding is primary-only)
  if (!onWorkers && replicaConnectionString && replicaConnectionString !== primaryConnectionString) {
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
  dbInstance: ReturnType<typeof createDrizzleInstance> | undefined;
};

// Lazy initialization wrapper using a Proxy to avoid connections/crashes at build time
export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    const value = Reflect.get(globalForDb.dbInstance, prop);
    if (typeof value === 'function') {
      return value.bind(globalForDb.dbInstance);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.set(globalForDb.dbInstance, prop, value);
  },
  has(target, prop) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.has(globalForDb.dbInstance, prop);
  },
  ownKeys(target) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.ownKeys(globalForDb.dbInstance);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.getOwnPropertyDescriptor(globalForDb.dbInstance, prop);
  }
});
