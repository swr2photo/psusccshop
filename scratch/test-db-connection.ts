import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function testConnection() {
  console.log('--- DB Connection Test ---');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not Set');
  console.log('DATABASE_READ_URL:', process.env.DATABASE_READ_URL ? 'Set' : 'Not Set');
  
  try {
    const start = Date.now();
    const result = await db.execute(sql`SELECT 1 as val`);
    console.log('✅ DB connection successful!');
    console.log('Query result:', JSON.stringify(result));
    console.log(`Latency: ${Date.now() - start}ms`);
  } catch (error) {
    console.error('❌ DB connection failed:');
    console.error(error);
  }
}

testConnection();
