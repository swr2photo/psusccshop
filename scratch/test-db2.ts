// scratch/test-db2.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL2;
  console.log('Connecting to DATABASE_URL2:', url);
  if (!url) {
    console.error('DATABASE_URL2 is not set');
    return;
  }
  const { parse } = require('pg-connection-string');
  const config = parse(url);
  if (config.password) {
    config.password = decodeURIComponent(config.password);
  }
  const pool = new Pool(config);
  try {
    const db = drizzle(pool);
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in new database:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error connecting:', err);
  } finally {
    await pool.end();
  }
}

main();
