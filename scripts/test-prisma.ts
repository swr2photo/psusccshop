// scripts/test-prisma.ts
// ทดสอบการเชื่อมต่อ Prisma กับ Supabase PostgreSQL

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
  console.log('🔌 กำลังเชื่อมต่อ database...');
  
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    // ทดสอบ query จำนวน orders
    const orderCount = await prisma.order.count();
    console.log(`✅ เชื่อมต่อสำเร็จ! Orders: ${orderCount}`);

    // ทดสอบ query จำนวน profiles
    const profileCount = await prisma.profile.count();
    console.log(`✅ Profiles: ${profileCount}`);

    // ทดสอบ query จำนวน shops
    const shopCount = await prisma.shop.count();
    console.log(`✅ Shops: ${shopCount}`);

    // ทดสอบ query จำนวน configs
    const configCount = await prisma.config.count();
    console.log(`✅ Configs: ${configCount}`);

    console.log('\n🎉 Prisma เชื่อมต่อ database ได้สมบูรณ์!');
  } catch (error) {
    console.error('❌ เชื่อมต่อไม่สำเร็จ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
