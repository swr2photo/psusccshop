#!/usr/bin/env node
/**
 * Push DATABASE_URL from .env.local / .env to Vercel production.
 * Run after resetting Supabase password or switching to Session pooler.
 *
 * Usage: npm run env:vercel:db
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function run(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

const env = {
  ...loadEnvFile(path.join(root, '.env')),
  ...loadEnvFile(path.join(root, '.env.local')),
};

const databaseUrl = env.DATABASE_URL || env.DATABASE_URL2;
if (!databaseUrl) {
  console.error('DATABASE_URL not found in .env or .env.local');
  process.exit(1);
}

if (databaseUrl.includes('sslmode=require')) {
  console.warn('Warning: DATABASE_URL contains sslmode=require — remove it before syncing.');
}

try {
  const host = new URL(databaseUrl).hostname;
  const port = new URL(databaseUrl).port || '5432';
  console.log(`Syncing DATABASE_URL → Vercel production (host=${host}, port=${port})`);
} catch {
  console.log('Syncing DATABASE_URL → Vercel production');
}

const whoami = run('npx', ['vercel', 'whoami']);
if (whoami.status !== 0) {
  console.error('Run: npx vercel login && npx vercel link');
  process.exit(1);
}

const add = run('npx', [
  'vercel',
  'env',
  'add',
  'DATABASE_URL',
  'production',
  '--value',
  databaseUrl,
  '--yes',
  '--force',
]);

if (add.status !== 0) {
  console.error(add.stderr || add.stdout);
  process.exit(1);
}

console.log('\nDone. Redeploy Vercel: npx vercel --prod');
console.log('Optional: remove DATABASE_READ_URL from Vercel unless USE_DB_READ_REPLICA=1');
