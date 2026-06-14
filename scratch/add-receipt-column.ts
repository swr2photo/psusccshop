import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Adding receipt_issued_at to orders...');
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_issued_at text;`);
    console.log('Success!');
  } catch (e) {
    console.error('Failed:', e);
  }
}

main();
