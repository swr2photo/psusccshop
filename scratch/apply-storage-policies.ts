// scratch/apply-storage-policies.ts
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
    console.log('Applying RLS policies to allow anon select/upload/delete/update for images bucket...');
    
    // Enable anonymous SELECT
    await pool.query(`
      DROP POLICY IF EXISTS "Anon can view images" ON storage.objects;
      CREATE POLICY "Anon can view images" ON storage.objects
        FOR SELECT TO anon USING (bucket_id = 'images');
    `);

    // Enable anonymous inserts
    await pool.query(`
      DROP POLICY IF EXISTS "Anon can upload images" ON storage.objects;
      CREATE POLICY "Anon can upload images" ON storage.objects
        FOR INSERT TO anon WITH CHECK (bucket_id = 'images');
    `);
    
    // Enable anonymous deletes
    await pool.query(`
      DROP POLICY IF EXISTS "Anon can delete images" ON storage.objects;
      CREATE POLICY "Anon can delete images" ON storage.objects
        FOR DELETE TO anon USING (bucket_id = 'images');
    `);
    
    // Enable anonymous updates
    await pool.query(`
      DROP POLICY IF EXISTS "Anon can update images" ON storage.objects;
      CREATE POLICY "Anon can update images" ON storage.objects
        FOR UPDATE TO anon USING (bucket_id = 'images') WITH CHECK (bucket_id = 'images');
    `);
    
    console.log('Successfully applied storage policies for the anon role.');
  } catch (err: any) {
    console.error('Error applying policies:', err.message || err);
  } finally {
    await pool.end();
  }
}

main();
