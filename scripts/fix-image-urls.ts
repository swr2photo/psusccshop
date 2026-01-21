#!/usr/bin/env npx tsx
// scripts/fix-image-urls.ts
// Fix incorrectly encrypted URLs (migrated with wrong secret)

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex);
          let value = trimmed.substring(eqIndex + 1);
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
    console.log('✅ Loaded .env.local');
  }
}

loadEnvFile();

const client = new S3Client({
  region: 'us-east-1',
  endpoint: 'https://s3.filebase.com',
  credentials: { 
    accessKeyId: process.env.FILEBASE_ACCESS_KEY!, 
    secretAccessKey: process.env.FILEBASE_SECRET_KEY! 
  },
});

// OLD WRONG SECRET used in first migration
const OLD_WRONG_SECRET = 'psusccshop-aes256-secure-crypto-key-2026-!@#$%^&*()';

// CORRECT SECRET matching image-crypto.ts
const CORRECT_SECRET = process.env.IMAGE_CRYPTO_SECRET || 'psusccshop-image-secure-2026-!@#$%^&*()';

// Legacy XOR secret for original URLs
const LEGACY_SECRET = process.env.IMAGE_PROXY_SECRET || 'psusccshop-image-proxy-2026';

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function decryptAES(token: string, secret: string): string | null {
  try {
    const key = deriveKey(secret);
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);
    const combined = Buffer.from(base64, 'base64');
    if (combined.length < 29) return null;
    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(12, 28);
    const ciphertext = combined.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const payload = JSON.parse(decrypted.toString('utf8'));
    return payload.url;
  } catch {
    return null;
  }
}

function decryptLegacyXOR(token: string): string | null {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);
    const decoded = Buffer.from(base64, 'base64').map((byte, i) => 
      byte ^ LEGACY_SECRET.charCodeAt(i % LEGACY_SECRET.length)
    );
    const url = Buffer.from(decoded).toString('utf-8');
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

function encryptAES(url: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const payload = { url, timestamp: Date.now(), nonce: crypto.randomBytes(8).toString('hex') };
  const plaintext = JSON.stringify(payload);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return '/api/image/' + combined.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function tryDecrypt(proxyUrl: string): string | null {
  if (!proxyUrl || !proxyUrl.startsWith('/api/image/')) return null;
  const token = proxyUrl.replace('/api/image/', '');
  
  // Try old wrong AES secret first
  let original = decryptAES(token, OLD_WRONG_SECRET);
  if (original) {
    console.log('  📦 Decrypted with OLD AES secret');
    return original;
  }
  
  // Try correct AES secret
  original = decryptAES(token, CORRECT_SECRET);
  if (original) {
    console.log('  📦 Already using correct secret');
    return null; // Already correct, no need to re-encrypt
  }
  
  // Try legacy XOR
  original = decryptLegacyXOR(token);
  if (original) {
    console.log('  📦 Decrypted with legacy XOR');
    return original;
  }
  
  return null;
}

const streamToString = async (stream: Readable): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
};

async function fixConfig() {
  console.log('\n📋 Fixing shop config...');
  
  const res = await client.send(new GetObjectCommand({ 
    Bucket: 'psusccshop-data', 
    Key: 'config/shop-settings.json' 
  }));
  
  if (!res.Body) {
    console.log('  ⚠️ No config found');
    return;
  }
  
  const body = await streamToString(res.Body as Readable);
  const config = JSON.parse(body);
  
  let changed = false;
  
  // Fix announcement imageUrl
  if (config.announcement?.imageUrl) {
    console.log('  Checking announcement imageUrl...');
    const original = tryDecrypt(config.announcement.imageUrl);
    if (original) {
      config.announcement.imageUrl = encryptAES(original, CORRECT_SECRET);
      console.log(`  ✅ Fixed: ${original.substring(0, 60)}...`);
      changed = true;
    }
  }
  
  // Fix product images
  if (config.products) {
    for (let i = 0; i < config.products.length; i++) {
      const p = config.products[i];
      
      // Cover image
      if (p.coverImage) {
        console.log(`  Checking product[${i}] coverImage...`);
        const original = tryDecrypt(p.coverImage);
        if (original) {
          config.products[i].coverImage = encryptAES(original, CORRECT_SECRET);
          console.log(`  ✅ Fixed: ${original.substring(0, 60)}...`);
          changed = true;
        }
      }
      
      // Images array
      if (p.images && Array.isArray(p.images)) {
        for (let j = 0; j < p.images.length; j++) {
          if (p.images[j]) {
            console.log(`  Checking product[${i}].images[${j}]...`);
            const original = tryDecrypt(p.images[j]);
            if (original) {
              config.products[i].images[j] = encryptAES(original, CORRECT_SECRET);
              console.log(`  ✅ Fixed: ${original.substring(0, 60)}...`);
              changed = true;
            }
          }
        }
      }
    }
  }
  
  // Fix announcements array
  if (config.announcements && Array.isArray(config.announcements)) {
    for (let i = 0; i < config.announcements.length; i++) {
      if (config.announcements[i].imageUrl) {
        console.log(`  Checking announcements[${i}] imageUrl...`);
        const original = tryDecrypt(config.announcements[i].imageUrl);
        if (original) {
          config.announcements[i].imageUrl = encryptAES(original, CORRECT_SECRET);
          console.log(`  ✅ Fixed: ${original.substring(0, 60)}...`);
          changed = true;
        }
      }
    }
  }
  
  if (changed) {
    await client.send(new PutObjectCommand({
      Bucket: 'psusccshop-data',
      Key: 'config/shop-settings.json',
      Body: JSON.stringify(config, null, 2),
      ContentType: 'application/json',
    }));
    console.log('\n💾 Config saved with CORRECT AES encryption!');
  } else {
    console.log('\n✅ No changes needed - URLs already correct or could not be decrypted');
  }
}

async function main() {
  console.log('🔧 Fixing Image URLs (Wrong Secret → Correct Secret)');
  console.log('=====================================================');
  console.log(`Old Wrong Secret: ${OLD_WRONG_SECRET.substring(0, 20)}...`);
  console.log(`Correct Secret: ${CORRECT_SECRET.substring(0, 20)}...`);
  console.log(`Legacy XOR Secret: ${LEGACY_SECRET.substring(0, 20)}...`);
  
  await fixConfig();
  
  console.log('\n✅ Fix completed!');
  console.log('');
  console.log('⚠️ Restart the dev server to test changes.');
}

main().catch(console.error);
