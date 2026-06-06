// scripts/test-db.ts
// ทดสอบการเชื่อมต่อ Drizzle กับ Supabase PostgreSQL

import 'dotenv/config';
import { db } from '../src/lib/db';
import { count } from 'drizzle-orm';
import { orders, profiles, shops, config } from '../src/db/schema';

async function main() {
  console.log('🔌 กำลังเชื่อมต่อ database ผ่าน Drizzle ORM...');

  try {
    // ทดสอบ query จำนวน orders
    const ordersResult = await db.select({ value: count() }).from(orders);
    console.log(`✅ เชื่อมต่อสำเร็จ! Orders: ${ordersResult[0]?.value || 0}`);

    // ทดสอบ query จำนวน profiles
    const profilesResult = await db.select({ value: count() }).from(profiles);
    console.log(`✅ Profiles: ${profilesResult[0]?.value || 0}`);

    // ทดสอบ query จำนวน shops
    const shopsResult = await db.select({ value: count() }).from(shops);
    console.log(`✅ Shops: ${shopsResult[0]?.value || 0}`);

    // ทดสอบ query จำนวน configs
    const configsResult = await db.select({ value: count() }).from(config);
    console.log(`✅ Configs: ${configsResult[0]?.value || 0}`);

    console.log('\n🎉 Drizzle เชื่อมต่อ database ได้สมบูรณ์!');
    process.exit(0);
  } catch (error) {
    console.error('❌ เชื่อมต่อไม่สำเร็จ:', error);
    process.exit(1);
  }
}

main();
