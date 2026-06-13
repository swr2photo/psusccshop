// src/lib/db.ts
// Drizzle ORM — node-postgres (Vercel/Bun) or postgres.js (Cloudflare Workers + Hyperdrive)

import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePostgresJs } from 'drizzle-orm/postgres-js';
import { withReplicas } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';

type DbInstance = ReturnType<typeof drizzleNodePg<typeof schema>>;

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

function createWorkersDrizzleInstance(): DbInstance {
  const connectionString = resolvePrimaryConnectionString();
  const client = postgres(connectionString, {
    max: 1,
    fetch_types: false,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzlePostgresJs(client, { schema }) as unknown as DbInstance;
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

function createDrizzleInstance(): DbInstance {
  if (isCloudflareWorkersRuntime()) {
    return createWorkersDrizzleInstance();
  }
  return createNodeDrizzleInstance();
}

const globalForDb = globalThis as unknown as {
  dbInstance: DbInstance | undefined;
};

// Lazy initialization wrapper using a Proxy to avoid connections/crashes at build time
export const db = new Proxy({} as DbInstance, {
  get(_target, prop, _receiver) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    const value = Reflect.get(globalForDb.dbInstance as object, prop);
    if (typeof value === 'function') {
      return value.bind(globalForDb.dbInstance);
    }
    return value;
  },
  set(_target, prop, value, _receiver) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.set(globalForDb.dbInstance as object, prop, value);
  },
  has(_target, prop) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.has(globalForDb.dbInstance as object, prop);
  },
  ownKeys(_target) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.ownKeys(globalForDb.dbInstance as object);
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (!globalForDb.dbInstance) {
      globalForDb.dbInstance = createDrizzleInstance();
    }
    return Reflect.getOwnPropertyDescriptor(globalForDb.dbInstance as object, prop);
  },
});
