// scratch/test-connection.ts
import { Client } from 'pg';
import { parse } from 'pg-connection-string';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const connectionString = process.env.DATABASE_URL!;
  console.log('Testing with raw connection string...');
  const client1 = new Client({ connectionString });
  try {
    await client1.connect();
    console.log('client1 connected successfully!');
    await client1.end();
  } catch (err) {
    console.error('client1 failed:', err);
  }

  console.log('\nTesting with parsed and decoded password...');
  const config = parse(connectionString);
  if (config.password) {
    config.password = decodeURIComponent(config.password);
  }
  const client2 = new Client(config);
  try {
    await client2.connect();
    console.log('client2 connected successfully!');
    await client2.end();
  } catch (err) {
    console.error('client2 failed:', err);
  }
}

run();
