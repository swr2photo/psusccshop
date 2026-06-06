import { db } from '../src/lib/db';
import { config } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Testing connection to DB...');
  console.log('DATABASE_URL is:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
  
  try {
    const results = await db.select().from(config).limit(1);
    console.log('Success! Connection works.');
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (error: any) {
    console.error('Error querying DB:', error);
  }
}

main();
