// scratch/test-old-supabase.ts
import fetch from 'node-fetch';

async function testUrl(name: string, url: string) {
  try {
    const res = await fetch(url);
    console.log(`- ${name} (${url}): Status ${res.status} ${res.statusText}`);
  } catch (err: any) {
    console.log(`- ${name} (${url}): Error: ${err.message || err}`);
  }
}

async function main() {
  console.log('Testing connectivity to Supabase projects:');
  await testUrl('Old Supabase (skfacffsynjxyvvvuycl)', 'https://skfacffsynjxyvvvuycl.supabase.co');
  await testUrl('New Supabase (dqecqtmebioqhrkusahz)', 'https://dqecqtmebioqhrkusahz.supabase.co');
  
  // Test listing buckets with old service key on both projects
  const { createClient } = await import('@supabase/supabase-js');
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrZmFjZmZzeW5qeHl2dnZ1eWNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAwNjg0NCwiZXhwIjoyMDg0NTgyODQ0fQ.XDomaxiw9LYvxSwzruZH_9a1zvOJ5XBdGwQTZ3cuPno';
  
  console.log('\nTesting storage listBuckets on both projects:');
  try {
    const clientOld = createClient('https://skfacffsynjxyvvvuycl.supabase.co', serviceKey);
    const { data: dataOld, error: errorOld } = await clientOld.storage.listBuckets();
    if (errorOld) console.log('Old Project storage error:', errorOld.message);
    else console.log('Old Project storage success! Buckets:', dataOld.map(b => b.name));
  } catch (err: any) {
    console.log('Old Project storage exception:', err.message || err);
  }

  try {
    const clientNew = createClient('https://dqecqtmebioqhrkusahz.supabase.co', serviceKey);
    const { data: dataNew, error: errorNew } = await clientNew.storage.listBuckets();
    if (errorNew) console.log('New Project storage error:', errorNew.message);
    else console.log('New Project storage success! Buckets:', dataNew.map(b => b.name));
  } catch (err: any) {
    console.log('New Project storage exception:', err.message || err);
  }
}

main();
