// scratch/test-db3.ts
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const connectionString = "postgresql://postgres.dqecqtmebioqhrkusahz:5AHjA_V8tYw7b%23m@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected!');
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in new database:', res.rows.map(r => r.table_name));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
