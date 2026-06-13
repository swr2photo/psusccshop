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

function createNodeDrizzleInstance(): DbInstance {
  const primaryConnectionString = resolvePrimaryConnectionString();
  const replicaConnectionString = process.env.DATABASE_READ_URL;

  const primaryPool = new Pool({
    connectionString: primaryConnectionString,
    max: parseInt(process.env.DB_POOL_MAX || '5'),
    min: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  });

  const primaryDb = drizzleNodePg(primaryPool, { schema });

  if (replicaConnectionString && replicaConnectionString !== primaryConnectionString) {
    const replicaPool = new Pool({
      connectionString: replicaConnectionString,
      max: parseInt(process.env.DB_POOL_MAX || '5'),
      min: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      keepAlive: true,
    });

    const replicaDb = drizzleNodePg(replicaPool, { schema });
    console.log('⚖️ เปิดใช้งาน Drizzle Read Replicas (Load Balancing) เรียบร้อยแล้ว');
    return withReplicas(primaryDb, [replicaDb]) as unknown as DbInstance;
  }

  console.log('🔌 เชื่อมต่อฐานข้อมูลหลัก (Primary DB เท่านั้น)');
  return primaryDb as unknown as DbInstance;
}

const globalForDb = globalThis as unknown as {
  dbInstance: DbInstance | undefined;
  postgresClient: ReturnType<typeof postgres> | undefined;
};

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

/** Drop pooled client after transient Hyperdrive errors (Workers: per-request scope only). */
export async function resetDbConnection(): Promise<void> {
  if (isCloudflareWorkersRuntime()) {
    await resetWorkersDbConnection();
    return;
  }

  const client = globalForDb.postgresClient;
  globalForDb.dbInstance = undefined;
  globalForDb.postgresClient = undefined;
  if (!client) return;
  try {
    await client.end({ timeout: 2 });
  } catch {
    /* ignore */
  }
}
