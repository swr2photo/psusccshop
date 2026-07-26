import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

function mask(v) {
  if (!v) return 'MISSING';
  return `${v.slice(0, 12)}...(${v.length})`;
}

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL2 ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anon =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY2 ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY2 ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

console.log('url:', mask(url));
console.log('service:', mask(serviceKey));
console.log('anon:', mask(anon));

if (!url || !serviceKey) {
  console.error('Cannot probe storage — missing url or service key');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1x1 PNG
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const asBuffer = png;
const asPlain = new Uint8Array(png);

async function tryUpload(label, body) {
  const path = `probe/${Date.now()}_${label}.png`;
  const { data, error } = await admin.storage.from('images').upload(path, body, {
    contentType: 'image/png',
    upsert: false,
  });
  console.log(label, error ? `ERR: ${error.message}` : `OK: ${data?.path}`);
  if (!error) {
    await admin.storage.from('images').remove([path]);
  }
}

const { data: buckets, error: bErr } = await admin.storage.listBuckets();
console.log(
  'buckets:',
  bErr ? `ERR ${bErr.message}` : buckets?.map((b) => `${b.id}:public=${b.public}`).join(', '),
);

await tryUpload('buffer', asBuffer);
await tryUpload('uint8', asPlain);
await tryUpload('arraybuffer', asPlain.buffer.slice(asPlain.byteOffset, asPlain.byteOffset + asPlain.byteLength));
