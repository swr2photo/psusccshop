#!/usr/bin/env node
/**
 * Generate psusccshop-api/.dev.vars from monorepo .env for wrangler secret bulk.
 * Usage: node scripts/sync-workers-secrets.mjs
 * Then:  cd ../psusccshop-api && npx wrangler secret bulk .dev.vars
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, '..', 'psusccshop-api', '.dev.vars');

const SKIP = new Set([
  'NODE_ENV', // wrangler.jsonc vars
  'API_INTERNAL_URL',
  'NEXT_PUBLIC_API_URL',
  'DATABASE_URL', // Hyperdrive handles DB; omit unless you need fallback
]);

/** Prefer these; empty values skipped unless listed in OPTIONAL_OK */
const API_KEYS = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_BASE_URL',
  'COOKIE_DOMAIN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL2',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY2',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2',
  'FILEBASE_ENDPOINT',
  'FILEBASE_REGION',
  'FILEBASE_BUCKET',
  'FILEBASE_ACCESS_KEY',
  'FILEBASE_SECRET_KEY',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CLIENT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_SHEET_ID',
  'GOOGLE_DRIVE_FOLDER_ID',
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_CLIENT_SECRET',
  'AZURE_AD_TENANT_ID',
  'FACEBOOK_CLIENT_ID',
  'FACEBOOK_CLIENT_SECRET',
  'LINE_CLIENT_ID',
  'LINE_CLIENT_SECRET',
  'APPLE_ID',
  'APPLE_SECRET',
  'ADMIN_EMAILS',
  'SUPER_ADMIN_EMAIL',
  'CRON_SECRET',
  'IMAGE_CRYPTO_SECRET',
  'IMAGE_PROXY_SECRET',
  'TURNSTILE_SECRET_KEY',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'SLIPOK_API_KEY',
  'SLIPOK_BRANCH_ID',
  'PAYMENT_BANK',
  'PAYMENT_ACCOUNT',
  'PAYMENT_ACCOUNT_NAME',
  'PROMPTPAY_ID',
  'GEMINI_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'TRACK123_API_KEY',
  'THAILANDPOST_API_KEY',
  'VAPID_PRIVATE_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'FIREBASE_PROJECT_ID',
  'GAS_SCRIPT_URL',
  'REQUEST_SIGNATURE_SECRET',
  'API_RATE_LIMIT_MAX',
  'API_RATE_LIMIT_WINDOW_MS',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  let key = '';
  let val = '';
  let inMultiline = false;

  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    if (inMultiline) {
      val += '\n' + line;
      if (line.trim().endsWith('"')) {
        inMultiline = false;
        out[key] = val.slice(1, -1).replace(/\\n/g, '\n');
      }
      continue;
    }
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    key = t.slice(0, eq).trim();
    let rest = t.slice(eq + 1).trim();
    if (rest.startsWith('"') && !rest.endsWith('"')) {
      inMultiline = true;
      val = rest;
      continue;
    }
    if ((rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'"))) {
      rest = rest.slice(1, -1);
    }
    out[key] = rest.replace(/\\n/g, '\n');
  }
  return out;
}

const env = {
  ...parseEnvFile(path.join(ROOT, '.env')),
  ...parseEnvFile(path.join(ROOT, '.env.local')),
};

// API worker should use production frontend URL for auth callbacks
env.NEXTAUTH_URL = env.NEXTAUTH_URL?.includes('localhost')
  ? 'https://sccshop.psuscc.club'
  : env.NEXTAUTH_URL || 'https://sccshop.psuscc.club';
env.NEXT_PUBLIC_BASE_URL = env.NEXT_PUBLIC_BASE_URL || 'https://sccshop.psuscc.club';
env.COOKIE_DOMAIN = env.COOKIE_DOMAIN || '.psuscc.club';

const lines = [];
for (const key of API_KEYS) {
  if (SKIP.has(key)) continue;
  let value = env[key];
  if (value === undefined || value === '') continue;
  if (key === 'GOOGLE_PRIVATE_KEY') {
    value = value.replace(/\r?\n/g, '\\n');
  }
  lines.push(`${key}=${value}`);
}

writeFileSync(OUT, lines.join('\n') + '\n', 'utf8');
console.log(`Wrote ${lines.length} vars → ${OUT}`);
console.log(`
Upload ทีเดียว:
  cd ${path.dirname(OUT)}
  npx wrangler login
  npx wrangler secret bulk .dev.vars

หมายเหตุ: .dev.vars อยู่ใน .gitignore — อย่า commit
`);
