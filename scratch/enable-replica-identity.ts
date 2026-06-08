// scratch/enable-replica-identity.ts
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
    console.log('Enabling REPLICA IDENTITY FULL for config, shops, and orders tables...');
    
    await pool.query('ALTER TABLE public.config REPLICA IDENTITY FULL;');
    console.log('Successfully set REPLICA IDENTITY FULL on public.config');
    
    await pool.query('ALTER TABLE public.shops REPLICA IDENTITY FULL;');
    console.log('Successfully set REPLICA IDENTITY FULL on public.shops');
    
    await pool.query('ALTER TABLE public.orders REPLICA IDENTITY FULL;');
    console.log('Successfully set REPLICA IDENTITY FULL on public.orders');

  } catch (err: any) {
    console.error('Error enabling replica identity:', err.message || err);
  } finally {
    await pool.end();
  }
}

main();
