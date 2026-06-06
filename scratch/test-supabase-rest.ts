// scratch/test-supabase-rest.ts
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('Missing env vars');
    return;
  }
  console.log(`Fetching ${url}/rest/v1/config ...`);
  try {
    const res = await fetch(`${url}/rest/v1/config`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log(`Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log(`Response body: ${text}`);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

main();
