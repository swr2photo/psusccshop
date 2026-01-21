#!/usr/bin/env npx ts-node
// scripts/migrate-image-urls.ts
// Migration script to re-encode all image URLs from legacy XOR to AES-256-GCM

import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ==================== LOAD .env.local ====================

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
          // Remove quotes
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

// ==================== CONFIGURATION ====================

const endpoint = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const region = process.env.FILEBASE_REGION || 'us-east-1';
const bucket = process.env.FILEBASE_BUCKET || 'psusccshop-data';
const accessKeyId = process.env.FILEBASE_ACCESS_KEY;
const secretAccessKey = process.env.FILEBASE_SECRET_KEY;

// Legacy XOR secret
const LEGACY_SECRET = process.env.IMAGE_PROXY_SECRET || 'psusccshop-image-proxy-2026';

// New AES secret - MUST match image-crypto.ts
const AES_SECRET = process.env.IMAGE_CRYPTO_SECRET || 'psusccshop-image-secure-2026-!@#$%^&*()';

const s3Client = new S3Client({
  region,
  endpoint,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

// ==================== HELPER FUNCTIONS ====================

const streamToString = async (stream: Readable): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
};

async function getJson<T = any>(key: string): Promise<T | null> {
  try {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) return null;
    const body = await streamToString(res.Body as Readable);
    return JSON.parse(body) as T;
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function putJson(key: string, data: any): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    })
  );
}

async function listKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3Client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    (res.Contents || []).forEach((obj) => {
      if (obj.Key) keys.push(obj.Key);
    });
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

// ==================== DECRYPTION (Legacy XOR) ====================

function decryptLegacyUrl(proxyUrl: string): string | null {
  if (!proxyUrl) return null;
  
  // Extract token from /api/image/{token}
  const match = proxyUrl.match(/^\/api\/image\/(.+)$/);
  if (!match) return null;
  
  const token = match[1];
  
  try {
    // Restore base64 padding
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padding);
    
    // Decode and XOR with legacy secret key
    const decoded = Buffer.from(base64, 'base64').map((byte, i) => 
      byte ^ LEGACY_SECRET.charCodeAt(i % LEGACY_SECRET.length)
    );
    
    const url = Buffer.from(decoded).toString('utf-8');
    
    // Validate it looks like a URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    return null;
  } catch {
    return null;
  }
}

// ==================== ENCRYPTION (New AES-256-GCM) ====================

function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(AES_SECRET).digest();
}

interface EncryptedPayload {
  url: string;
  timestamp: number;
  nonce: string;
}

function encryptImageUrl(url: string): string {
  if (!url) return '';
  
  // Skip if already a proxy URL (will be re-encrypted)
  // Skip data URLs
  if (url.startsWith('data:')) return url;
  
  try {
    const key = deriveKey();
    
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.randomBytes(12);
    
    // Create payload with timestamp
    const payload: EncryptedPayload = {
      url,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    };
    
    const plaintext = JSON.stringify(payload);
    
    // Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Get auth tag (16 bytes)
    const authTag = cipher.getAuthTag();
    
    // Combine: IV (12) + Auth Tag (16) + Ciphertext
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    // Convert to URL-safe base64
    const base64 = combined
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return `/api/image/${base64}`;
  } catch (error) {
    console.error('[Migration] Encryption error:', error);
    return url;
  }
}

// ==================== MIGRATION FUNCTIONS ====================

function migrateUrl(proxyUrl: string): string {
  if (!proxyUrl) return proxyUrl;
  
  // Skip if not a proxy URL
  if (!proxyUrl.startsWith('/api/image/')) {
    // If it's a raw URL, encrypt it
    if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
      console.log(`  📦 Encrypting raw URL: ${proxyUrl.substring(0, 50)}...`);
      return encryptImageUrl(proxyUrl);
    }
    return proxyUrl;
  }
  
  // Decrypt legacy URL
  const originalUrl = decryptLegacyUrl(proxyUrl);
  if (!originalUrl) {
    console.log(`  ⚠️ Could not decrypt: ${proxyUrl.substring(0, 50)}...`);
    return proxyUrl;
  }
  
  // Re-encrypt with AES
  const newUrl = encryptImageUrl(originalUrl);
  console.log(`  ✅ Migrated: ${originalUrl.substring(0, 50)}... → AES encrypted`);
  
  return newUrl;
}

function migrateObjectUrls(obj: any, path: string = ''): { changed: boolean; obj: any } {
  if (obj === null || obj === undefined) {
    return { changed: false, obj };
  }
  
  if (Array.isArray(obj)) {
    let changed = false;
    const newArr = obj.map((item, i) => {
      const result = migrateObjectUrls(item, `${path}[${i}]`);
      if (result.changed) changed = true;
      return result.obj;
    });
    return { changed, obj: newArr };
  }
  
  if (typeof obj === 'object') {
    let changed = false;
    const newObj: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check if this is an image URL field
      if (typeof value === 'string' && isImageUrlField(key, value)) {
        const newValue = migrateUrl(value);
        if (newValue !== value) {
          changed = true;
          console.log(`  Field: ${currentPath}`);
        }
        newObj[key] = newValue;
      } else if (typeof value === 'object' && value !== null) {
        const result = migrateObjectUrls(value, currentPath);
        if (result.changed) changed = true;
        newObj[key] = result.obj;
      } else {
        newObj[key] = value;
      }
    }
    
    return { changed, obj: newObj };
  }
  
  return { changed: false, obj };
}

function isImageUrlField(key: string, value: string): boolean {
  // Check field names that typically contain image URLs
  const imageFields = ['imageUrl', 'coverImage', 'image', 'images', 'slipImageUrl', 'avatar'];
  const isImageField = imageFields.some(f => key.toLowerCase().includes(f.toLowerCase()));
  
  // Check if value looks like a proxy URL or raw image URL
  const isProxyUrl = value.startsWith('/api/image/');
  const isRawUrl = (value.startsWith('http://') || value.startsWith('https://')) && 
    (value.includes('ipfs') || value.includes('filebase') || value.includes('.png') || 
     value.includes('.jpg') || value.includes('.jpeg') || value.includes('.gif') || 
     value.includes('.webp'));
  
  return isImageField && (isProxyUrl || isRawUrl);
}

// ==================== MAIN MIGRATION ====================

async function migrateConfig(): Promise<void> {
  console.log('\n📋 Migrating shop config...');
  
  const config = await getJson('config/shop-settings.json');
  if (!config) {
    console.log('  ⚠️ No config found');
    return;
  }
  
  const result = migrateObjectUrls(config);
  
  if (result.changed) {
    await putJson('config/shop-settings.json', result.obj);
    console.log('  💾 Config saved with new AES-encrypted URLs');
  } else {
    console.log('  ℹ️ No changes needed');
  }
}

async function migrateOrders(): Promise<void> {
  console.log('\n📦 Migrating orders...');
  
  const orderKeys = await listKeys('orders/');
  const orderFiles = orderKeys.filter(k => k.endsWith('.json') && !k.includes('/index/'));
  
  console.log(`  Found ${orderFiles.length} order files`);
  
  let migratedCount = 0;
  
  for (const key of orderFiles) {
    const order = await getJson(key);
    if (!order) continue;
    
    const result = migrateObjectUrls(order);
    
    if (result.changed) {
      await putJson(key, result.obj);
      migratedCount++;
      console.log(`  💾 Saved: ${key}`);
    }
  }
  
  console.log(`  ✅ Migrated ${migratedCount}/${orderFiles.length} orders`);
}

async function migrateOrderIndexes(): Promise<void> {
  console.log('\n📑 Migrating order indexes...');
  
  const indexKeys = await listKeys('orders/index/');
  
  console.log(`  Found ${indexKeys.length} index files`);
  
  let migratedCount = 0;
  
  for (const key of indexKeys) {
    const index = await getJson<any[]>(key);
    if (!index) continue;
    
    const result = migrateObjectUrls(index);
    
    if (result.changed) {
      await putJson(key, result.obj);
      migratedCount++;
      console.log(`  💾 Saved: ${key}`);
    }
  }
  
  console.log(`  ✅ Migrated ${migratedCount}/${indexKeys.length} indexes`);
}

async function main() {
  console.log('🔄 Starting Image URL Migration (XOR → AES-256-GCM)');
  console.log('================================================');
  console.log(`Bucket: ${bucket}`);
  console.log(`Legacy Secret: ${LEGACY_SECRET.substring(0, 10)}...`);
  console.log(`AES Secret: ${AES_SECRET.substring(0, 10)}...`);
  
  if (!accessKeyId || !secretAccessKey) {
    console.error('❌ Missing FILEBASE_ACCESS_KEY or FILEBASE_SECRET_KEY');
    process.exit(1);
  }
  
  try {
    // Migrate shop config
    await migrateConfig();
    
    // Migrate orders
    await migrateOrders();
    
    // Migrate order indexes
    await migrateOrderIndexes();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('');
    console.log('⚠️ Note: Clear browser cache and restart the dev server to see changes.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
