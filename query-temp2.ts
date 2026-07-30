import { db } from './src/lib/db';
import { shops } from './src/db/schema';

async function main() {
  try {
    const s = await db.select().from(shops).limit(1);
    if (s.length > 0) {
      console.log(JSON.stringify(s[0], null, 2));
    } else {
      console.log("No shops found");
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

main();
