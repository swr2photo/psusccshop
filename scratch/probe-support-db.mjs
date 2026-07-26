import fs from 'fs';
import pg from 'pg';

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const url = env.DATABASE_URL || env.DATABASE_URL2;
if (!url) {
  console.error('no DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'support%'
    ORDER BY 1
  `);
  console.log('tables:', tables.rows.map((r) => r.table_name));

  const cols = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='support_chats'
    ORDER BY ordinal_position
  `);
  console.log('support_chats cols:', cols.rows.map((r) => r.column_name).join(', ') || '(missing)');

  if (cols.rows.length) {
    const counts = await client.query(`
      SELECT status, count(*)::int AS n FROM support_chats GROUP BY status
    `);
    console.log('counts:', counts.rows);

    // same queries the route runs
    await client.query(`SELECT * FROM support_chats WHERE status='pending' ORDER BY created_at`);
    await client.query(`SELECT * FROM support_chats WHERE status='active' ORDER BY last_message_at DESC`);
    console.log('select pending/active: OK');
  }
} catch (e) {
  console.error('ERR', e.message);
} finally {
  client.release();
  await pool.end();
}
