/**
 * Verify index-only scans for covering indexes
 * Usage: npx tsx scripts/verify-covering-indexes.ts
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function explain(pool: Pool, label: string, sql: string) {
  const res = await pool.query(`EXPLAIN (FORMAT TEXT) ${sql}`);
  const plan = res.rows.map((r: { 'QUERY PLAN': string }) => r['QUERY PLAN']).join('\n');
  const indexOnly = /Index Only Scan/i.test(plan);
  console.log(`\n=== ${label} ===`);
  console.log(plan);
  console.log(indexOnly ? '✓ Index Only Scan detected' : '✗ No Index Only Scan (check column list / stats)');
}

async function main() {
  const url = process.env.DATABASE_URL2 || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  try {
    await explain(
      pool,
      'Admin order list',
      `SELECT ref, status, customer_name, customer_email, customer_phone, total_amount,
              shipping_option, tracking_number, shop_id, payment_verified, date, created_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 100`,
    );

    await explain(
      pool,
      'Email logs list',
      `SELECT id, created_at, to_email, from_email, subject, email_type, status, order_ref, sent_at, error
       FROM email_logs
       ORDER BY created_at DESC
       LIMIT 100`,
    );

    await explain(
      pool,
      'User logs list',
      `SELECT id, created_at, email, name, action, details, ip, user_agent
       FROM user_logs
       ORDER BY created_at DESC
       LIMIT 100`,
    );
  } finally {
    await pool.end();
  }
}

main();
