import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import crypto from 'crypto';
import { db } from '../src/lib/db';
import { carts } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { getJson } from '../src/lib/supabase';

const email = 'doralaikon.th@gmail.com';
const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

async function main() {
  console.log('hash', hash);
  try {
    const data = await db.select().from(carts).where(eq(carts.emailHash, hash)).limit(1);
    console.log('direct select ok', data.length, data[0] ? 'has row' : 'empty');
  } catch (e: any) {
    console.error('direct select fail', e?.message || e);
  }
  try {
    const data = await getJson(`carts/${hash}.json`);
    console.log('getJson ok', Array.isArray(data) ? `array:${data.length}` : data);
  } catch (e: any) {
    console.error('getJson fail', e?.message || e);
  }
  process.exit(0);
}
main();
