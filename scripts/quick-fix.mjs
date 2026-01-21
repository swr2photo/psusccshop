// Quick fix script - re-encrypt URLs with correct secret
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { Readable } from 'stream';
import fs from 'fs';

// Load env
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    envVars[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
});

const client = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.filebase.com',
  credentials: { 
    accessKeyId: envVars.FILEBASE_ACCESS_KEY, 
    secretAccessKey: envVars.FILEBASE_SECRET_KEY 
  },
});

// Secrets
const OLD_SECRET = 'psusccshop-aes256-secure-crypto-key-2026-!@#$%^&*()';
const CORRECT_SECRET = envVars.IMAGE_CRYPTO_SECRET || 'psusccshop-image-secure-2026-!@#$%^&*()';

console.log('OLD:', OLD_SECRET.slice(0, 30) + '...');
console.log('CORRECT:', CORRECT_SECRET.slice(0, 30) + '...');

function deriveKey(s) { return crypto.createHash('sha256').update(s).digest(); }

function decrypt(token, secret) {
  try {
    let b = token.replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - (b.length % 4)) % 4);
    const c = Buffer.from(b, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), c.subarray(0, 12));
    d.setAuthTag(c.subarray(12, 28));
    let r = d.update(c.subarray(28));
    r = Buffer.concat([r, d.final()]);
    return JSON.parse(r.toString()).url;
  } catch { return null; }
}

function encrypt(url, secret) {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const p = JSON.stringify({ url, timestamp: Date.now(), nonce: crypto.randomBytes(8).toString('hex') });
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(p, 'utf8');
  enc = Buffer.concat([enc, cipher.final()]);
  const combined = Buffer.concat([iv, cipher.getAuthTag(), enc]);
  return '/api/image/' + combined.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fix(proxyUrl) {
  if (!proxyUrl?.startsWith('/api/image/')) return null;
  const token = proxyUrl.replace('/api/image/', '');
  // Try OLD secret
  const url = decrypt(token, OLD_SECRET);
  if (url) return encrypt(url, CORRECT_SECRET);
  // Already correct?
  if (decrypt(token, CORRECT_SECRET)) return null;
  return null;
}

async function main() {
  console.log('\n📥 Fetching config...');
  const res = await client.send(new GetObjectCommand({ Bucket: 'psusccshop-data', Key: 'config/shop-settings.json' }));
  const chunks = []; for await (const c of res.Body) chunks.push(c);
  const config = JSON.parse(Buffer.concat(chunks).toString());
  
  let changed = false;
  
  // Fix announcement
  if (config.announcement?.imageUrl) {
    const f = fix(config.announcement.imageUrl);
    if (f) { config.announcement.imageUrl = f; changed = true; console.log('✅ Fixed announcement'); }
  }
  
  // Fix products
  for (const p of (config.products || [])) {
    if (p.coverImage) {
      const f = fix(p.coverImage);
      if (f) { p.coverImage = f; changed = true; console.log('✅ Fixed product coverImage:', p.name); }
    }
    for (let i = 0; i < (p.images?.length || 0); i++) {
      const f = fix(p.images[i]);
      if (f) { p.images[i] = f; changed = true; console.log('✅ Fixed product image:', p.name, i); }
    }
  }
  
  if (changed) {
    await client.send(new PutObjectCommand({
      Bucket: 'psusccshop-data',
      Key: 'config/shop-settings.json',
      Body: JSON.stringify(config, null, 2),
      ContentType: 'application/json'
    }));
    console.log('\n💾 Saved! Restart dev server.');
  } else {
    console.log('\n⚠️ No changes made');
  }
}

main().catch(console.error);
