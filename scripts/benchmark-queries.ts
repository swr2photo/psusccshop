// scripts/benchmark-queries.ts
// ทดสอบความเร็ว query หลักๆ หลังสร้าง indexes
// Usage: npx tsx scripts/benchmark-queries.ts

import 'dotenv/config';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

interface BenchResult {
  label: string;
  query: string;
  planningMs: number;
  executionMs: number;
  totalMs: number;
  scanType: string;
  indexUsed: string | null;
  rowsReturned: number;
}

async function explainAnalyze(client: pg.PoolClient, label: string, query: string): Promise<BenchResult> {
  // First run: warm up index and catalog cache for this specific query planner path
  await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);

  // Second run: measure actual warmed planning and execution time
  const res = await client.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
  const plan = res.rows[0]['QUERY PLAN'][0];
  const topPlan = plan.Plan;

  // Walk the plan tree to find the first scan node
  function findScan(node: any): { type: string; index: string | null } {
    const nodeType = node['Node Type'] || '';
    if (nodeType.includes('Scan')) {
      let indexName = node['Index Name'] || null;
      if (!indexName && node.Plans && node.Plans.length > 0) {
        for (const child of node.Plans) {
          if (child['Node Type'] === 'Bitmap Index Scan' && child['Index Name']) {
            indexName = child['Index Name'];
            break;
          }
        }
      }
      return {
        type: nodeType,
        index: indexName,
      };
    }
    if (node.Plans && node.Plans.length > 0) {
      for (const child of node.Plans) {
        const result = findScan(child);
        if (result.type) return result;
      }
    }
    return { type: nodeType, index: null };
  }

  const scan = findScan(topPlan);

  return {
    label,
    query: query.substring(0, 120) + (query.length > 120 ? '...' : ''),
    planningMs: plan['Planning Time'],
    executionMs: plan['Execution Time'],
    totalMs: Math.round((plan['Planning Time'] + plan['Execution Time']) * 100) / 100,
    scanType: scan.type,
    indexUsed: scan.index,
    rowsReturned: topPlan['Actual Rows'] || 0,
  };
}

async function getTableStats() {
  const res = await pool.query(`
    SELECT relname AS table_name, 
           n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
  `);
  return res.rows;
}

async function getIndexList() {
  const res = await pool.query(`
    SELECT indexrelname AS index_name, relname AS table_name,
           pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY relname, indexrelname
  `);
  return res.rows;
}

async function main() {
  console.log('🔍 Database Performance Benchmark');
  console.log('='.repeat(70));

  // 1. Table stats
  console.log('\n📊 Table Row Counts:');
  const tables = await getTableStats();
  for (const t of tables) {
    console.log(`   ${t.table_name.padEnd(30)} ${String(t.row_count).padStart(8)} rows`);
  }

  // 2. Index list
  console.log('\n📑 Indexes Created:');
  const indexes = await getIndexList();
  const newIndexes = indexes.filter((i: any) => i.index_name && i.index_name.startsWith('idx_'));
  console.log(`   Found ${newIndexes.length} custom indexes (idx_*)`);
  for (const idx of newIndexes) {
    console.log(`   ✅ ${idx.index_name.padEnd(45)} (${idx.table_name}, ${idx.index_size})`);
  }

  // 3. Benchmark queries
  console.log('\n⚡ Query Benchmark (EXPLAIN ANALYZE - Forced Index Scan):');
  console.log('-'.repeat(70));

  const results: BenchResult[] = [];
  const client = await pool.connect();
  try {
    // Warm up PostgreSQL relation cache (relcache/catcache) for all tables to eliminate cold-start planning latency
    const tablesToWarmup = [
      'orders', 'support_chats', 'support_messages', 'rate_limits', 
      'blocked_ips', 'email_logs', 'user_logs', 'security_audit_log', 
      'passkey_credentials', 'inventory', 'shop_admins'
    ];
    for (const table of tablesToWarmup) {
      try {
        await client.query(`SELECT 1 FROM ${table} LIMIT 1`);
      } catch (e) {
        // Ignore errors if a table doesn't exist
      }
    }

    // Disable seq scans to force index scans for checking index feasibility on tiny tables
    await client.query('SET enable_seqscan = off');

    // Q1: Admin list — ORDER BY created_at DESC LIMIT 100
    results.push(await explainAnalyze(
      client,
      'Admin order list (latest 100)',
      `SELECT created_at, ref, status, customer_name, customer_email, total_amount, shop_id
       FROM orders ORDER BY created_at DESC LIMIT 100`
    ));

    // Q2: Customer orders by email_hash
    results.push(await explainAnalyze(
      client,
      'Customer orders (email_hash)',
      `SELECT * FROM orders WHERE email_hash = 'test_nonexistent_hash' ORDER BY created_at DESC LIMIT 100`
    ));

    // Q3: Orders by status
    results.push(await explainAnalyze(
      client,
      'Orders by status filter',
      `SELECT ref, status, created_at FROM orders WHERE status = 'WAITING_PAYMENT' ORDER BY created_at DESC LIMIT 50`
    ));

    // Q4: Status count aggregation
    results.push(await explainAnalyze(
      client,
      'Order status counts (GROUP BY)',
      `SELECT status, count(*) FROM orders GROUP BY status`
    ));

    // Q5: Shop orders
    results.push(await explainAnalyze(
      client,
      'Shop orders (shop_id filter)',
      `SELECT ref, status, created_at FROM orders WHERE shop_id = 'nonexistent' ORDER BY created_at DESC LIMIT 100`
    ));

    // Q6: Expired unpaid orders (cron)
    results.push(await explainAnalyze(
      client,
      'Expired unpaid orders (cron)',
      `SELECT ref, status, created_at FROM orders 
       WHERE status IN ('PENDING','WAITING_PAYMENT','AWAITING_PAYMENT','UNPAID','DRAFT')
         AND created_at < now() - interval '24 hours'`
    ));

    // Q7: Support messages by session
    results.push(await explainAnalyze(
      client,
      'Chat messages by session_id',
      `SELECT * FROM support_messages WHERE session_id = '00000000-0000-0000-0000-000000000000' ORDER BY created_at`
    ));

    // Q8: Pending chats
    results.push(await explainAnalyze(
      client,
      'Pending support chats',
      `SELECT * FROM support_chats WHERE status = 'pending' ORDER BY created_at`
    ));

    // Q9: Rate limit lookup
    results.push(await explainAnalyze(
      client,
      'Rate limit lookup',
      `SELECT * FROM rate_limits WHERE identifier = 'api:test' LIMIT 1`
    ));

    // Q10: Blocked IP check
    results.push(await explainAnalyze(
      client,
      'Blocked IP check',
      `SELECT * FROM blocked_ips WHERE ip_address = '1.2.3.4' AND expires_at > now() LIMIT 1`
    ));

    // Q11: Email logs (admin view)
    results.push(await explainAnalyze(
      client,
      'Email logs (latest 100)',
      `SELECT id, created_at, to_email, subject, status FROM email_logs ORDER BY created_at DESC LIMIT 100`
    ));

    // Q12: User logs by email
    results.push(await explainAnalyze(
      client,
      'User logs by email',
      `SELECT id, created_at, email, action FROM user_logs WHERE email = 'test@test.com' ORDER BY created_at DESC LIMIT 100`
    ));

    // Q13: Security audit logs
    results.push(await explainAnalyze(
      client,
      'Security audit logs',
      `SELECT * FROM security_audit_log ORDER BY created_at DESC LIMIT 100`
    ));

    // Q14: Passkey credentials by email
    results.push(await explainAnalyze(
      client,
      'Passkey credentials by email',
      `SELECT * FROM passkey_credentials WHERE user_email = 'test@test.com'`
    ));

    // Q15: Inventory by product
    results.push(await explainAnalyze(
      client,
      'Inventory by product_id',
      `SELECT * FROM inventory WHERE product_id = 'test-product'`
    ));

    // Q16: Shop admins by email
    results.push(await explainAnalyze(
      client,
      'Shop admins by email',
      `SELECT * FROM shop_admins WHERE email = 'test@test.com'`
    ));
  } finally {
    client.release();
  }

  // Print results table
  console.log('');
  console.log(`${'Query'.padEnd(35)} ${'Time (ms)'.padStart(10)} ${'Scan Type'.padEnd(22)} ${'Index Used'.padEnd(40)} ${'Rows'.padStart(6)}`);
  console.log('-'.repeat(115));

  for (const r of results) {
    const scanIcon = r.scanType.includes('Index') ? '✅' : '⚠️';
    console.log(
      `${scanIcon} ${r.label.padEnd(33)} ${String(r.totalMs).padStart(10)} ${r.scanType.padEnd(22)} ${(r.indexUsed || '-').padEnd(40)} ${String(r.rowsReturned).padStart(6)}`
    );
  }

  // Summary
  const indexScans = results.filter(r => r.scanType.includes('Index'));
  const seqScans = results.filter(r => r.scanType === 'Seq Scan');
  const avgTime = results.reduce((sum, r) => sum + r.totalMs, 0) / results.length;

  console.log('\n' + '='.repeat(70));
  console.log(`📈 Summary:`);
  console.log(`   Total queries tested:  ${results.length}`);
  console.log(`   ✅ Using Index Scan:   ${indexScans.length}/${results.length}`);
  console.log(`   ⚠️  Sequential Scan:   ${seqScans.length}/${results.length}`);
  console.log(`   ⏱️  Average time:       ${avgTime.toFixed(2)} ms`);
  console.log(`   ⏱️  Max time:           ${Math.max(...results.map(r => r.totalMs)).toFixed(2)} ms`);
  console.log(`   ⏱️  Min time:           ${Math.min(...results.map(r => r.totalMs)).toFixed(2)} ms`);

  if (seqScans.length > 0) {
    console.log(`\n   ⚠️  Seq Scans detected on:`);
    for (const r of seqScans) {
      console.log(`      - ${r.label}`);
    }
  }

  await pool.end();
  console.log('\n✅ Benchmark complete');
}

main().catch((err) => {
  console.error('❌ Benchmark failed:', err);
  process.exit(1);
});
