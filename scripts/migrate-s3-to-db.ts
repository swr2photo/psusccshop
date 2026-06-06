// scripts/migrate-s3-to-db.ts
import 'dotenv/config';
import { db } from '../src/lib/db';
import * as schema from '../src/db/schema';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';

// Filebase S3 configuration
const s3Endpoint = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const s3Region = process.env.FILEBASE_REGION || 'us-east-1';
const s3Bucket = process.env.FILEBASE_BUCKET || 'psusccshop-data';
const s3AccessKey = process.env.FILEBASE_ACCESS_KEY || '';
const s3SecretKey = process.env.FILEBASE_SECRET_KEY || '';

const s3Client = new S3Client({
  region: s3Region,
  endpoint: s3Endpoint,
  credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
  forcePathStyle: true,
});

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();
const emailHash = (email: string) => crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function getS3Json<T = any>(key: string): Promise<T | null> {
  try {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: key }));
    if (!res.Body) return null;
    const body = await streamToString(res.Body as Readable);
    return JSON.parse(body) as T;
  } catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function listS3Keys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3Client.send(
      new ListObjectsV2Command({ Bucket: s3Bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    (res.Contents || []).forEach((obj) => {
      if (obj.Key) keys.push(obj.Key);
    });
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

// Migration functions

async function migrateConfig() {
  console.log('\n⚙️ Migrating config...');
  const keys = await listS3Keys('config/');
  let count = 0;
  for (const key of keys) {
    try {
      const data = await getS3Json(key);
      if (!data) continue;
      const configKey = key.replace('config/', '').replace('.json', '');
      
      await db.insert(schema.config)
        .values({
          key: configKey,
          value: data,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.config.key,
          set: { value: data, updatedAt: new Date() },
        });
      
      console.log(`  ✅ Migrated config: ${configKey}`);
      count++;
    } catch (err: any) {
      console.error(`  ❌ Failed to migrate config ${key}:`, err.message);
    }
  }
  console.log(`Config migration complete: ${count} migrated`);
}

async function migrateProfiles() {
  console.log('\n👤 Migrating profiles...');
  const keys = await listS3Keys('users/');
  let count = 0;
  for (const key of keys) {
    try {
      const data = await getS3Json(key);
      if (!data) continue;
      const hash = key.replace('users/', '').replace('.json', '');
      
      await db.insert(schema.profiles)
        .values({
          emailHash: hash,
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          instagram: data.instagram || null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.profiles.emailHash,
          set: {
            name: data.name || '',
            phone: data.phone || '',
            address: data.address || '',
            instagram: data.instagram || null,
            updatedAt: new Date(),
          },
        });
      
      count++;
    } catch (err: any) {
      console.error(`  ❌ Failed to migrate profile ${key}:`, err.message);
    }
  }
  console.log(`Profiles migration complete: ${count} migrated`);
}

async function migrateCarts() {
  console.log('\n🛒 Migrating carts...');
  const keys = await listS3Keys('carts/');
  let count = 0;
  for (const key of keys) {
    try {
      const data = await getS3Json(key);
      if (!data) continue;
      const hash = key.replace('carts/', '').replace('.json', '');
      
      await db.insert(schema.carts)
        .values({
          emailHash: hash,
          cartData: data,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.carts.emailHash,
          set: { cartData: data, updatedAt: new Date() },
        });
      
      count++;
    } catch (err: any) {
      console.error(`  ❌ Failed to migrate cart ${key}:`, err.message);
    }
  }
  console.log(`Carts migration complete: ${count} migrated`);
}

async function migrateOrders() {
  console.log('\n📦 Migrating orders...');
  const keys = await listS3Keys('orders/');
  const orderFiles = keys.filter(k => !k.includes('/index/') && k.endsWith('.json'));
  let count = 0;
  for (const key of orderFiles) {
    try {
      const data = await getS3Json(key);
      if (!data) continue;
      const email = data.customerEmail || data.email || '';
      
      await db.insert(schema.orders)
        .values({
          ref: data.ref,
          date: data.date || new Date().toISOString(),
          status: data.status || 'WAITING_PAYMENT',
          customerName: data.customerName || data.name || '',
          customerEmail: email,
          emailHash: emailHash(email),
          customerPhone: data.customerPhone || data.phone || '',
          customerAddress: data.customerAddress || data.address || '',
          customerInstagram: data.customerInstagram || data.instagram || null,
          cart: data.cart || [],
          totalAmount: data.totalAmount || data.amount || 0,
          notes: data.notes || null,
          slipData: data.slip || data.slipData || null,
          paymentVerifiedAt: data.paymentVerifiedAt || null,
          paymentMethod: data.paymentMethod || null,
          shippingOption: data.shippingOption || null,
          pickupData: data.pickup || null,
          createdAt: data.date ? new Date(data.date) : new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.orders.ref,
          set: {
            status: data.status || 'WAITING_PAYMENT',
            customerName: data.customerName || data.name || '',
            customerEmail: email,
            customerPhone: data.customerPhone || data.phone || '',
            customerAddress: data.customerAddress || data.address || '',
            customerInstagram: data.customerInstagram || data.instagram || null,
            cart: data.cart || [],
            totalAmount: data.totalAmount || data.amount || 0,
            notes: data.notes || null,
            slipData: data.slip || data.slipData || null,
            paymentVerifiedAt: data.paymentVerifiedAt || null,
            paymentMethod: data.paymentMethod || null,
            shippingOption: data.shippingOption || null,
            pickupData: data.pickup || null,
            updatedAt: new Date(),
          },
        });
      
      count++;
    } catch (err: any) {
      console.error(`  ❌ Failed to migrate order ${key}:`, err.message);
    }
  }
  console.log(`Orders migration complete: ${count} migrated`);
}

async function migrateEmailLogs() {
  console.log('\n📧 Migrating email logs...');
  const keys = await listS3Keys('email-logs/');
  let count = 0;
  for (const key of keys) {
    try {
      const data = await getS3Json(key);
      if (!data) continue;
      
      await db.insert(schema.emailLogs)
        .values({
          orderRef: data.orderRef || null,
          toEmail: data.to || '',
          fromEmail: data.from || '',
          subject: data.subject || '',
          body: data.body || '',
          emailType: data.type || 'custom',
          status: data.status || 'pending',
          sentAt: data.sentAt || null,
          error: data.error || null,
          createdAt: data.timestamp ? new Date(data.timestamp) : new Date(),
        })
        .onConflictDoNothing();
      
      count++;
    } catch (err: any) {
      console.error(`  ❌ Failed to migrate email log ${key}:`, err.message);
    }
  }
  console.log(`Email logs migration complete: ${count} migrated`);
}

async function main() {
  console.log('🚀 Starting S3 to Drizzle Database Migration...');
  
  if (!s3AccessKey || !s3SecretKey) {
    console.error('❌ Missing Filebase S3 credentials!');
    process.exit(1);
  }
  
  await migrateConfig();
  await migrateProfiles();
  await migrateCarts();
  await migrateOrders();
  await migrateEmailLogs();
  
  console.log('\n🎉 Migration complete!');
  process.exit(0);
}

main();
