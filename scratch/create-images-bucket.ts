// scratch/create-images-bucket.ts
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
    console.log('Inserting "images" bucket into storage.buckets in the new database...');
    await pool.query(`
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
        'images',
        'images',
        true,
        5242880,
        ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      )
      ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    `);
    console.log('Successfully created/updated "images" bucket.');
  } catch (err: any) {
    console.error('Error creating bucket:', err.message || err);
  } finally {
    await pool.end();
  }
}

main();
