import 'dotenv/config';
import { db } from '../src/lib/db';
import { passkeyCredentials, passkeyChallenges } from '../src/db/schema';

async function main() {
  console.log('--- Passkey Credentials ---');
  try {
    const creds = await db.select().from(passkeyCredentials);
    console.log(`Found ${creds.length} passkeys:`);
    console.dir(creds, { depth: null });

    console.log('\n--- Passkey Challenges ---');
    const challenges = await db.select().from(passkeyChallenges);
    console.log(`Found ${challenges.length} active challenges:`);
    console.dir(challenges, { depth: null });
  } catch (error) {
    console.error('Error querying passkeys:', error);
  }
  process.exit(0);
}

main();
