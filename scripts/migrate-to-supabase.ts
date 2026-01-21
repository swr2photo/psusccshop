// scripts/migrate-to-supabase.ts
// Migration script to move data from Filebase S3 to Supabase
// Run with: npx ts-node scripts/migrate-to-supabase.ts

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';

// ==================== CONFIGURATION ====================

// Filebase (source)
const s3Endpoint = process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com';
const s3Region = process.env.FILEBASE_REGION || 'us-east-1';
const s3Bucket = process.env.FILEBASE_BUCKET || '';
const s3AccessKey = process.env.FILEBASE_ACCESS_KEY || '';
const s3SecretKey = process.env.FILEBASE_SECRET_KEY || '';

// Supabase (target)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ==================== CLIENTS ====================

const s3Client = new S3Client({
  region: s3Region,
  endpoint: s3Endpoint,
  credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
});

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ==================== HELPERS ====================

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

// ==================== MIGRATION FUNCTIONS ====================

async function migrateOrders() {
  console.log('\n📦 Migrating orders...');
  
  const orderKeys = await listS3Keys('orders/');
  const orderFiles = orderKeys.filter(k => !k.includes('/index/') && k.endsWith('.json'));
  
  console.log(`Found ${orderFiles.length} orders to migrate`);
  
  let migrated = 0;
  let failed = 0;
  
  for (const key of orderFiles) {
    try {
      const order = await getS3Json<any>(key);
      if (!order) continue;
      
      const email = order.customerEmail || order.email || '';
      
      const dbOrder = {
        ref: order.ref,
        date: order.date || new Date().toISOString(),
        status: order.status || 'WAITING_PAYMENT',
        customer_name: order.customerName || order.name || '',
        customer_email: email,
        email_hash: emailHash(email),
        customer_phone: order.customerPhone || order.phone || '',
        customer_address: order.customerAddress || order.address || '',
        customer_instagram: order.customerInstagram || order.instagram || null,
        cart: order.cart || [],
        total_amount: order.totalAmount || order.amount || 0,
        notes: order.notes || null,
        slip_data: order.slipData || null,
        payment_verified_at: order.paymentVerifiedAt || null,
        payment_method: order.paymentMethod || null,
        pickup_status: order.pickupStatus || null,
        pickup_at: order.pickupAt || null,
        pickup_by: order.pickupBy || null,
        created_at: order.date || order.createdAt || new Date().toISOString(),
        updated_at: order.updatedAt || new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('orders')
        .upsert(dbOrder, { onConflict: 'ref' });
      
      if (error) {
        console.error(`  ❌ Failed to migrate order ${order.ref}:`, error.message);
        failed++;
      } else {
        migrated++;
        if (migrated % 50 === 0) {
          console.log(`  ✅ Migrated ${migrated} orders...`);
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing ${key}:`, error.message);
      failed++;
    }
  }
  
  console.log(`✅ Orders migration complete: ${migrated} migrated, ${failed} failed`);
}

async function migrateConfig() {
  console.log('\n⚙️ Migrating config...');
  
  const configKeys = await listS3Keys('config/');
  
  for (const key of configKeys) {
    try {
      const config = await getS3Json<any>(key);
      if (!config) continue;
      
      const configKey = key.replace('config/', '').replace('.json', '');
      
      const { error } = await supabase
        .from('config')
        .upsert({ 
          key: configKey, 
          value: config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      if (error) {
        console.error(`  ❌ Failed to migrate config ${configKey}:`, error.message);
      } else {
        console.log(`  ✅ Migrated config: ${configKey}`);
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing ${key}:`, error.message);
    }
  }
  
  console.log('✅ Config migration complete');
}

async function migrateProfiles() {
  console.log('\n👤 Migrating profiles...');
  
  const profileKeys = await listS3Keys('users/');
  
  let migrated = 0;
  
  for (const key of profileKeys) {
    try {
      const profile = await getS3Json<any>(key);
      if (!profile) continue;
      
      const hash = key.replace('users/', '').replace('.json', '');
      
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          email_hash: hash,
          name: profile.name || '',
          phone: profile.phone || '',
          address: profile.address || '',
          instagram: profile.instagram || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email_hash' });
      
      if (error) {
        console.error(`  ❌ Failed to migrate profile:`, error.message);
      } else {
        migrated++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing ${key}:`, error.message);
    }
  }
  
  console.log(`✅ Profiles migration complete: ${migrated} migrated`);
}

async function migrateCarts() {
  console.log('\n🛒 Migrating carts...');
  
  const cartKeys = await listS3Keys('carts/');
  
  let migrated = 0;
  
  for (const key of cartKeys) {
    try {
      const cart = await getS3Json<any>(key);
      if (!cart) continue;
      
      const hash = key.replace('carts/', '').replace('.json', '');
      
      const { error } = await supabase
        .from('carts')
        .upsert({ 
          email_hash: hash,
          cart_data: cart,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email_hash' });
      
      if (error) {
        console.error(`  ❌ Failed to migrate cart:`, error.message);
      } else {
        migrated++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing ${key}:`, error.message);
    }
  }
  
  console.log(`✅ Carts migration complete: ${migrated} migrated`);
}

async function migrateEmailLogs() {
  console.log('\n📧 Migrating email logs...');
  
  const logKeys = await listS3Keys('email-logs/');
  
  let migrated = 0;
  
  for (const key of logKeys) {
    try {
      const log = await getS3Json<any>(key);
      if (!log) continue;
      
      const { error } = await supabase
        .from('email_logs')
        .upsert({
          id: log.id,
          order_ref: log.orderRef || null,
          to_email: log.to || '',
          from_email: log.from || '',
          subject: log.subject || '',
          body: log.body || '',
          email_type: log.type || 'custom',
          status: log.status || 'pending',
          sent_at: log.sentAt || null,
          error: log.error || null,
          created_at: log.timestamp || new Date().toISOString(),
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`  ❌ Failed to migrate email log:`, error.message);
      } else {
        migrated++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing ${key}:`, error.message);
    }
  }
  
  console.log(`✅ Email logs migration complete: ${migrated} migrated`);
}

async function migrateUserLogs() {
  console.log('\n📝 Migrating user logs...');
  
  const logKeys = await listS3Keys('user-logs/');
  
  let migrated = 0;
  
  for (const key of logKeys) {
    try {
      const log = await getS3Json<any>(key);
      if (!log) continue;
      
      const { error } = await supabase
        .from('user_logs')
        .upsert({
          id: log.id,
          email: log.email || '',
          name: log.name || null,
          action: log.action || '',
          details: log.details || null,
          metadata: log.metadata || null,
          ip: log.ip || null,
          user_agent: log.userAgent || null,
          created_at: log.timestamp || new Date().toISOString(),
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`  ❌ Failed to migrate user log:`, error.message);
      } else {
        migrated++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing ${key}:`, error.message);
    }
  }
  
  console.log(`✅ User logs migration complete: ${migrated} migrated`);
}

async function migrateDataRequests() {
  console.log('\n📋 Migrating data requests...');
  
  const requestKeys = await listS3Keys('data-requests/');
  
  let migrated = 0;
  
  for (const key of requestKeys) {
    try {
      const request = await getS3Json<any>(key);
      if (!request) continue;
      
      const { error } = await supabase
        .from('data_requests')
        .upsert({
          id: request.id,
          email: request.email || '',
          request_type: request.requestType || request.type || 'access',
          status: request.status || 'pending',
          details: request.details || null,
          processed_at: request.processedAt || null,
          processed_by: request.processedBy || null,
          created_at: request.createdAt || new Date().toISOString(),
        }, { onConflict: 'id' });
      
      if (error) {
        console.error(`  ❌ Failed to migrate data request:`, error.message);
      } else {
        migrated++;
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing ${key}:`, error.message);
    }
  }
  
  console.log(`✅ Data requests migration complete: ${migrated} migrated`);
}

// ==================== MAIN ====================

async function main() {
  console.log('🚀 Starting Filebase to Supabase migration...\n');
  
  // Validate configuration
  if (!s3Bucket || !s3AccessKey || !s3SecretKey) {
    console.error('❌ Missing Filebase configuration. Set FILEBASE_* environment variables.');
    process.exit(1);
  }
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration. Set SUPABASE_* environment variables.');
    process.exit(1);
  }
  
  console.log('📊 Source: Filebase S3');
  console.log(`   Bucket: ${s3Bucket}`);
  console.log('📊 Target: Supabase');
  console.log(`   URL: ${supabaseUrl}\n`);
  
  try {
    // Run migrations in order
    await migrateConfig();
    await migrateProfiles();
    await migrateCarts();
    await migrateOrders();
    await migrateEmailLogs();
    await migrateUserLogs();
    await migrateDataRequests();
    
    console.log('\n✨ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Verify data in Supabase dashboard');
    console.log('2. Update .env.local with Supabase credentials');
    console.log('3. Update import statements from filebase to supabase');
    console.log('4. Test the application thoroughly');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
