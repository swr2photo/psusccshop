// Runs scripts/migration-realtime-config.sql against the project database(s).
// Usage: node scripts/run-migration-realtime-config.mjs
// Reads DATABASE_URL / DATABASE_URL2 from .env/.env.local (never prints them).
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv(file) {
  const full = path.join(root, file);
  if (!existsSync(full)) return {};
  const out = {};
  for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) {
      out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const sql = readFileSync(path.join(root, 'scripts', 'migration-realtime-config.sql'), 'utf8');

const targets = [...new Set([env.DATABASE_URL, env.DATABASE_URL2].filter(Boolean))];
if (targets.length === 0) {
  console.error('No DATABASE_URL found in .env/.env.local');
  process.exit(1);
}

const mask = (url) => {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^db\./, '').split('.')[0].slice(0, 8) + '...';
  } catch {
    return '(unparseable url)';
  }
};

let failed = false;
for (const url of targets) {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    const check = await client.query(
      `SELECT
         EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'config') AS in_publication,
         EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'config' AND policyname = 'anon_read_config_version') AS policy_ok,
         EXISTS (SELECT 1 FROM public.config WHERE key = 'config-version') AS version_row`
    );
    const { in_publication, policy_ok, version_row } = check.rows[0];
    console.log(`[${mask(url)}] migration applied — publication: ${in_publication}, policy: ${policy_ok}, version row: ${version_row}`);
    if (!in_publication || !policy_ok || !version_row) failed = true;
  } catch (err) {
    failed = true;
    console.error(`[${mask(url)}] FAILED: ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

process.exit(failed ? 1 : 0);
