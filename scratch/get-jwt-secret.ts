// scratch/get-jwt-secret.ts
import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL2 || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    return;
  }
  const { parse } = require('pg-connection-string');
  const config = parse(url);
  if (config.password) {
    config.password = decodeURIComponent(config.password);
  }
  const pool = new Pool(config);
  try {
    const res = await pool.query(`
      SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    `);
    console.log('Tables in supabase_realtime publication:', res.rows);
  } catch (err: any) {
    console.error('Error querying pg_publication_tables:', err.message || err);
  } finally {
    await pool.end();
  }
}

main();
