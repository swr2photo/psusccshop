// scripts/backup-db-to-filebase.ts
// สคริปต์ดึงข้อมูลจากตารางหลักทั้งหมดใน Supabase และอัปโหลดไปยัง Filebase S3
// เพื่อทำการสำรองข้อมูลฐานข้อมูล (Database Backup) — Drizzle ORM

import 'dotenv/config';
import { db } from '../src/lib/db';
import * as schema from '../src/db/schema';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const filebaseClient = new S3Client({
  endpoint: process.env.FILEBASE_ENDPOINT || 'https://s3.filebase.com',
  region: process.env.FILEBASE_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY || '',
    secretAccessKey: process.env.FILEBASE_SECRET_KEY || '',
  },
  forcePathStyle: true, // จำเป็นสำหรับ S3-compatible providers อย่าง Filebase
});

async function runBackup() {
  console.log('🔄 เริ่มต้นทำการสำรองข้อมูลฐานข้อมูล...');
  
  try {
    const backupData: Record<string, any> = {
      backup_timestamp: new Date().toISOString(),
      data: {}
    };

    // 1. ดึงข้อมูลจากตารางต่างๆ ในฐานข้อมูลด้วย Drizzle ORM
    const tablesToBackup = [
      { name: 'config', query: () => db.select().from(schema.config) },
      { name: 'orders', query: () => db.select().from(schema.orders) },
      { name: 'profiles', query: () => db.select().from(schema.profiles) },
      { name: 'carts', query: () => db.select().from(schema.carts) },
      { name: 'shops', query: () => db.select().from(schema.shops) },
      { name: 'shopAdmins', query: () => db.select().from(schema.shopAdmins) },
      { name: 'adminPermissions', query: () => db.select().from(schema.adminPermissions) },
      { name: 'emailLogs', query: () => db.select().from(schema.emailLogs) },
      { name: 'userLogs', query: () => db.select().from(schema.userLogs) },
      { name: 'dataRequests', query: () => db.select().from(schema.dataRequests) },
      { name: 'keyValueStore', query: () => db.select().from(schema.keyValueStore) },
      { name: 'securityAuditLog', query: () => db.select().from(schema.securityAuditLog) },
      { name: 'supportChats', query: () => db.select().from(schema.supportChats) },
      { name: 'supportMessages', query: () => db.select().from(schema.supportMessages) },
      { name: 'passkeyCredentials', query: () => db.select().from(schema.passkeyCredentials) },
      { name: 'pushSubscriptions', query: () => db.select().from(schema.pushSubscriptions) },
      { name: 'rateLimits', query: () => db.select().from(schema.rateLimits) },
      { name: 'blockedIps', query: () => db.select().from(schema.blockedIps) },
    ];

    for (const table of tablesToBackup) {
      console.log(`📥 กำลังดึงข้อมูลจากตาราง: ${table.name}...`);
      try {
        const rows = await table.query();
        backupData.data[table.name] = rows;
        console.log(`   ✅ ดึงข้อมูลสำเร็จ (${rows.length} แถว)`);
      } catch (err: any) {
        // ข้ามหากตารางยังไม่มี หรือมีปัญหา
        console.warn(`   ⚠️ ไม่สามารถดึงข้อมูลตาราง ${table.name} ได้:`, err.message || err);
        backupData.data[table.name] = [];
      }
    }

    // 2. แปลงข้อมูลเป็น JSON String
    const backupJson = JSON.stringify(backupData, null, 2);
    const fileName = `backups/db-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const bucketName = process.env.FILEBASE_BUCKET || 'psusccshop-data';

    console.log(`📤 กำลังอัปโหลดข้อมูลแบ็คอัปไปยัง Filebase S3 (${bucketName}/${fileName})...`);

    // 3. อัปโหลดไปยัง Filebase S3
    await filebaseClient.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: backupJson,
        ContentType: 'application/json',
      })
    );

    console.log(`\n🎉 การสำรองข้อมูลเสร็จสิ้นสมบูรณ์! ไฟล์บันทึกไว้ที่ S3: ${fileName}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการแบ็คอัปฐานข้อมูล:', error);
    process.exit(1);
  }
}

runBackup();
