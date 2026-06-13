/**
 * Per-request postgres.js + Drizzle on Cloudflare Workers.
 * Hyperdrive connections must not be shared across fetch handlers.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle as drizzlePostgresJs } from 'drizzle-orm/postgres-js';
import type { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import postgres from 'postgres';
import * as schema from '../db/schema';
import { isCloudflareWorkersRuntime } from '@/lib/runtime-env';

export type DbInstance = ReturnType<typeof drizzleNodePg<typeof schema>>;

type WorkersDbStore = {
  db: DbInstance;
  client: ReturnType<typeof postgres>;
};

const workersScope = new AsyncLocalStorage<WorkersDbStore>();

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

function createWorkersClient() {
  return postgres(resolvePrimaryConnectionString(), {
    max: 1,
    fetch_types: false,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

function createWorkersStore(): WorkersDbStore {
  const client = createWorkersClient();
  const db = drizzlePostgresJs(client, { schema }) as unknown as DbInstance;
  return { db, client };
}

async function disposeWorkersClient(client: ReturnType<typeof postgres>): Promise<void> {
  try {
    await client.end({ timeout: 2 });
  } catch {
    /* ignore */
  }
}

export function getWorkersDb(): DbInstance {
  const store = workersScope.getStore();
  if (!store) {
    throw new Error('[db] Workers DB used outside request scope');
  }
  return store.db;
}

/** Run fn with a dedicated Hyperdrive client for this Worker request. */
export function runWithWorkersDb<T>(fn: () => T | Promise<T>): T | Promise<T> {
  const store = createWorkersStore();
  return workersScope.run(store, () => {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => disposeWorkersClient(store.client));
    }
    void disposeWorkersClient(store.client);
    return result;
  });
}

export async function resetWorkersDbConnection(): Promise<void> {
  const store = workersScope.getStore();
  if (!store) return;
  await disposeWorkersClient(store.client);
  const fresh = createWorkersStore();
  store.db = fresh.db;
  store.client = fresh.client;
}

export function isWorkersDbScopeActive(): boolean {
  return isCloudflareWorkersRuntime() && workersScope.getStore() !== undefined;
}
