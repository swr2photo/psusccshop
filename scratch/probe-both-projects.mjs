import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const bytes = new Uint8Array(png);

async function probe(label, url, key) {
  if (!url || !key) {
    console.log(label, 'skip missing');
    return;
  }
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const path = `probe/${Date.now()}_${label}.png`;
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  console.log(
    label,
    'buckets:',
    bErr ? `ERR ${bErr.message}` : (buckets || []).map((b) => b.id).join(',') || '(none)',
  );
  const { data, error } = await admin.storage.from('images').upload(path, bytes, {
    contentType: 'image/png',
    upsert: false,
  });
  console.log(label, 'upload:', error ? `ERR ${error.message}` : `OK ${data?.path}`);
  if (!error) await admin.storage.from('images').remove([path]);
}

await probe('url1+service', env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
await probe('url2+service', env.NEXT_PUBLIC_SUPABASE_URL2, env.SUPABASE_SERVICE_ROLE_KEY);
await probe('url2+service2', env.NEXT_PUBLIC_SUPABASE_URL2, env.SUPABASE_SERVICE_ROLE_KEY2);
