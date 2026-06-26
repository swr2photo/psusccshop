// src/lib/db.ts
// Drizzle ORM — node-postgres (Vercel/Bun) or postgres.js (Cloudflare Workers + Hyperdrive)

import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { withReplicas } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';
import {
  getWorkersDb,
  resetWorkersDbConnection,
  type DbInstance,
} from '@/lib/db-workers-scope';

export type { DbInstance };

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

const globalForDb = globalThis as unknown as {
  dbInstance: DbInstance | undefined;
  postgresClient: ReturnType<typeof postgres> | undefined;
  primaryPool: Pool | undefined;
  replicaPool: Pool | undefined;
};

function normalizeConnectionString(connectionString: string): string {
  let normalized = connectionString.trim();

  // ?sslmode=require breaks node-pg on Vercel — use pool ssl option instead
  try {
    const parsed = new URL(normalized);
    parsed.searchParams.delete('sslmode');
    normalized = parsed.toString();
  } catch {
    normalized = normalized
      .replace(/([?&])sslmode=[^&]*(&|$)/gi, (_, sep, tail) => (tail === '&' ? sep : ''))
      .replace(/\?$/, '');
  }

  return normalized;
}

function poolConfig(connectionString: string) {
  const normalized = normalizeConnectionString(connectionString);
  const useSsl =
    normalized.includes('supabase.co') ||
    process.env.DB_SSL === '1' ||
    process.env.NODE_ENV === 'production';

  if (
    process.env.VERCEL === '1' &&
    normalized.includes('db.') &&
    normalized.includes('.supabase.co')
  ) {
    console.warn(
      '[db] Direct Supabase host on Vercel may fail — use Session pooler URI in DATABASE_URL',
    );
  }

  // Limit connection pool max in serverless runtime environments to prevent exhaustion
  const isServerless = process.env.VERCEL === '1' || process.env.LAMBDA === '1';
  const defaultMax = isServerless ? 1 : 5;
  const maxConnections = parseInt(process.env.DB_POOL_MAX || String(defaultMax), 10);

  return {
    connectionString: normalized,
    max: maxConnections,
    min: 0,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function createNodeDrizzleInstance(): DbInstance {
  const primaryConnectionString = normalizeConnectionString(resolvePrimaryConnectionString());
  const replicaConnectionString = process.env.DATABASE_READ_URL
    ? normalizeConnectionString(process.env.DATABASE_READ_URL)
    : undefined;

  try {
    const host = new URL(primaryConnectionString).hostname;
    console.log(`[db] Connecting primary host=${host}`);
  } catch {
    console.log('[db] Connecting primary (host parse skipped)');
  }

  const primaryPool = new Pool(poolConfig(primaryConnectionString));
  globalForDb.primaryPool = primaryPool;

  const primaryDb = drizzleNodePg(primaryPool, { schema });

  const useReplica =
    process.env.USE_DB_READ_REPLICA === '1' &&
    replicaConnectionString &&
    replicaConnectionString !== primaryConnectionString;

  if (useReplica) {
    const replicaPool = new Pool(poolConfig(replicaConnectionString));
    globalForDb.replicaPool = replicaPool;

    const replicaDb = drizzleNodePg(replicaPool, { schema });
    console.log('⚖️ เปิดใช้งาน Drizzle Read Replicas (Load Balancing) เรียบร้อยแล้ว');
    return withReplicas(primaryDb, [replicaDb]) as unknown as DbInstance;
  }

  console.log('🔌 เชื่อมต่อฐานข้อมูลหลัก (Primary DB เท่านั้น)');
  return primaryDb as unknown as DbInstance;
}

function resolveDbInstance(): DbInstance {
  if (isCloudflareWorkersRuntime()) {
    return getWorkersDb();
  }
  if (!globalForDb.dbInstance) {
    globalForDb.dbInstance = createNodeDrizzleInstance();
  }
  return globalForDb.dbInstance;
}

// Lazy initialization wrapper using a Proxy to avoid connections/crashes at build time
export const db = new Proxy({} as DbInstance, {
  get(_target, prop, _receiver) {
    const instance = resolveDbInstance();
    const value = Reflect.get(instance as object, prop);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  set(_target, prop, value, _receiver) {
    const instance = resolveDbInstance();
    return Reflect.set(instance as object, prop, value);
  },
  has(_target, prop) {
    return Reflect.has(resolveDbInstance() as object, prop);
  },
  ownKeys(_target) {
    return Reflect.ownKeys(resolveDbInstance() as object);
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(resolveDbInstance() as object, prop);
  },
});

/** Drop pooled client after transient DB errors. */
export async function resetDbConnection(): Promise<void> {
  if (isCloudflareWorkersRuntime()) {
    await resetWorkersDbConnection();
    return;
  }

  const pools = [globalForDb.primaryPool, globalForDb.replicaPool].filter(
    (pool): pool is Pool => pool !== undefined,
  );
  const client = globalForDb.postgresClient;

  globalForDb.dbInstance = undefined;
  globalForDb.primaryPool = undefined;
  globalForDb.replicaPool = undefined;
  globalForDb.postgresClient = undefined;

  await Promise.all([
    ...pools.map((pool) => pool.end().catch(() => undefined)),
    client ? client.end({ timeout: 2 }).catch(() => undefined) : Promise.resolve(),
  ]);
}
