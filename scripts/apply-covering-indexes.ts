/**
 * Apply scripts/supabase-covering-indexes-migration.sql to DATABASE_URL
 * Usage: npx tsx scripts/apply-covering-indexes.ts
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL2 || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sqlPath = join(__dirname, 'supabase-covering-indexes-migration.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  const pool = new Pool({ connectionString: url });
  try {
    console.log('Applying covering indexes migration...');
    await pool.query(sql);
    console.log('Done. Indexes created and ANALYZE completed.');

    const indexes = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE '%_covering'
      ORDER BY indexname
    `);
    console.log('\nCovering indexes present:');
    for (const row of indexes.rows) {
      console.log(' -', row.indexname);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Migration failed:', message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
