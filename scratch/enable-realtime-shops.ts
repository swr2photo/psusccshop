// scratch/enable-realtime-shops.ts
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const connectionString = process.env.DATABASE_URL!;
  console.log('Connecting to database...');
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected. Running ALTER PUBLICATION...');
    
    // Add shops table to supabase_realtime publication
    await client.query(`
      DO $$ BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    
    console.log('Successfully added public.shops to supabase_realtime publication!');
  } catch (err: any) {
    console.error('Failed to run migration:', err.message || err);
  } finally {
    await client.end();
  }
}

run();
