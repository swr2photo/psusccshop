#!/usr/bin/env node
/**
 * Print Hyperdrive connection strings + wrangler command.
 * Usage: node scripts/hyperdrive-setup.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

const env = { ...loadEnvFile(path.join(ROOT, '.env.local')), ...loadEnvFile(path.join(ROOT, '.env')) };
const raw = env.DATABASE_URL || env.DATABASE_URL2;

if (!raw) {
  console.error('DATABASE_URL not found in .env or .env.local');
  process.exit(1);
}

const sessionPooler = raw.replace(':6543/', ':5432/');
const direct = sessionPooler
  .replace(/@aws-[^/]+\.pooler\.supabase\.com:5432\//, '@db.dqecqtmebioqhrkusahz.supabase.co:5432/')
  .replace(/postgres\.dqecqtmebioqhrkusahz:/, 'postgres:');

const masked = (s) => s.replace(/:([^:@/]+)@/, ':***@');

console.log(`
=== Cloudflare Hyperdrive setup ===

1) ลอง Session pooler (IPv4) ก่อน — Dashboard หรือ CLI:
${sessionPooler}

2) ถ้า fail ลอง Direct (Hyperdrive รองรับ IPv6):
${direct}

⚠️  ห้ามใส่ ?sslmode=require
⚠️  ถ้ายัง "Invalid credentials" → Supabase → Reset database password
    (ใช้ a-z A-Z 0-9 อย่างเดียว ไม่มี #) แล้วอัปเดต .env

--- Wrangler CLI (จาก psusccshop-api) ---
cd ../psusccshop-api
npx wrangler hyperdrive create psusccshop-api --connection-string="${sessionPooler}"

--- หลังสร้างสำเร็จ ใส่ id ใน wrangler.jsonc ---
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<ID จาก output>" }]

Masked preview: ${masked(sessionPooler)}
`);
