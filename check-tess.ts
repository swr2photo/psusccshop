import { db } from './src/lib/drizzle';
import { config } from './src/lib/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const row = await db.select().from(config).where(eq(config.key, 'config-version'));
  if (row && row.length > 0) {
    const products = row[0].value.products;
    const tess = products.find(p => p.id === 'tess' || p.name.includes('tess'));
    console.log(JSON.stringify(tess, null, 2));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
