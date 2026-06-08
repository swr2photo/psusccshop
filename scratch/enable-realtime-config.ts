// scratch/enable-realtime-config.ts
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
    console.log('Adding "config" table to the "supabase_realtime" publication...');
    
    // Check if table is already in publication
    const checkRes = await pool.query(`
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'config'
    `);
    
    if (checkRes.rows.length === 0) {
      await pool.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE public.config;
      `);
      console.log('Successfully added "config" table to the realtime publication.');
    } else {
      console.log('"config" table is already in the publication.');
    }
  } catch (err: any) {
    console.error('Error enabling realtime for config:', err.message || err);
  } finally {
    await pool.end();
  }
}

main();
