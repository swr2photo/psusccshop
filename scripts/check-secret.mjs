// Check what secret the current config uses
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
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
  credentials: { accessKeyId: envVars.FILEBASE_ACCESS_KEY, secretAccessKey: envVars.FILEBASE_SECRET_KEY },
});

const CORRECT = envVars.IMAGE_CRYPTO_SECRET;
const OLD = 'psusccshop-aes256-secure-crypto-key-2026-!@#$%^&*()';

console.log('CORRECT from .env:', CORRECT);
console.log('OLD hardcoded:', OLD);

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

const res = await client.send(new GetObjectCommand({ Bucket: 'psusccshop-data', Key: 'config/shop-settings.json' }));
const chunks = []; for await (const c of res.Body) chunks.push(c);
const config = JSON.parse(Buffer.concat(chunks).toString());

const token = config.products?.[0]?.coverImage?.replace('/api/image/', '') || '';
console.log('\nToken (first 60):', token.slice(0, 60));
console.log('Decrypt CORRECT:', decrypt(token, CORRECT) ? '✅ SUCCESS' : '❌ FAIL');
console.log('Decrypt OLD:', decrypt(token, OLD) ? '✅ SUCCESS' : '❌ FAIL');
const url = decrypt(token, CORRECT) || decrypt(token, OLD);
console.log('\nOriginal URL:', url);
