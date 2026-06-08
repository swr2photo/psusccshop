// scratch/test-storage.ts
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const { getSupabaseAdmin } = await import('../src/lib/supabase');
  console.log('Testing getSupabaseAdmin() from src/lib/supabase.ts...');
  const adminDb = getSupabaseAdmin();
  if (!adminDb) {
    console.error('getSupabaseAdmin() returned null');
    return;
  }
  
  try {
    const { data, error } = await adminDb.storage.listBuckets();
    if (error) {
      console.error('Failed to list buckets:', error.message, error);
    } else {
      console.log('Successfully listed buckets:', data.map(b => b.name));
    }
  } catch (err: any) {
    console.error('Fetch exception:', err.message || err, err);
  }
}

run();
