// src/lib/prisma.ts
// Prisma Client singleton สำหรับ Next.js
// ป้องกัน multiple instances ใน development mode (hot reload)
// Prisma 7: ใช้ @prisma/adapter-pg driver adapter + import จาก generated path

import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

import { Pool } from 'pg';

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
    // Limit connections to avoid exhausting DB on Railway/serverless
    max: parseInt(process.env.DB_POOL_MAX || '5'),
    min: 1,
    // Release idle connections faster in serverless environments
    idleTimeoutMillis: 30_000,
    // Fail fast if DB is unreachable (don't queue indefinitely)
    connectionTimeoutMillis: 5_000,
    // Keep connections alive to avoid reconnect overhead
    keepAlive: true,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
