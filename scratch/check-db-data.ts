import { config } from 'dotenv';
import path from 'node:path';
import { count, sql } from 'drizzle-orm';
import { orders, config as configTable, carts, profiles, shops } from '@/db/schema';
import { db } from '@/lib/db';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

async function main() {
  console.log('=== DB data check ===');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'missing');

  const [orderCount] = await db.select({ value: count() }).from(orders);
  const [configCount] = await db.select({ value: count() }).from(configTable);
  const [cartCount] = await db.select({ value: count() }).from(carts);
  const [profileCount] = await db.select({ value: count() }).from(profiles);
  const [shopCount] = await db.select({ value: count() }).from(shops);

  const shopSettings = await db
    .select({ key: configTable.key })
    .from(configTable)
    .where(sql`${configTable.key} = 'shop-settings'`)
    .limit(1);

  const recentOrders = await db
    .select({ ref: orders.ref, status: orders.status, email: orders.customerEmail })
    .from(orders)
    .orderBy(sql`${orders.createdAt} desc`)
    .limit(5);

  console.log('orders:', orderCount?.value ?? 0);
  console.log('config rows:', configCount?.value ?? 0);
  console.log('carts:', cartCount?.value ?? 0);
  console.log('profiles:', profileCount?.value ?? 0);
  console.log('shops:', shopCount?.value ?? 0);
  console.log('shop-settings row:', shopSettings.length > 0 ? 'yes' : 'no');
  console.log('recent orders:', recentOrders);
}

main().catch((error) => {
  console.error('DB check failed:', error);
  process.exit(1);
});
