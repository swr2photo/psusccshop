import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/migrate-refund - One-time migration to add refund columns
 * Admin-only. Safe to run multiple times (uses IF NOT EXISTS pattern via upsert).
 */
export async function POST() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 });
  }

  const columns = [
    { name: 'refund_status', default_val: null },
    { name: 'refund_reason', default_val: null },
    { name: 'refund_details', default_val: null },
    { name: 'refund_bank_name', default_val: null },
    { name: 'refund_bank_account', default_val: null },
    { name: 'refund_account_name', default_val: null },
    { name: 'refund_amount', default_val: null },
    { name: 'refund_requested_at', default_val: null },
    { name: 'refund_reviewed_at', default_val: null },
    { name: 'refund_reviewed_by', default_val: null },
    { name: 'refund_admin_note', default_val: null },
  ];

  // Check which columns already exist
  const { data: sample, error: sampleError } = await db
    .from('orders')
    .select('*')
    .limit(1);

  if (sampleError) {
    return NextResponse.json({ error: `Failed to query orders: ${sampleError.message}` }, { status: 500 });
  }

  const existingColumns = sample && sample[0] ? Object.keys(sample[0]) : [];
  const missingColumns = columns.filter(c => !existingColumns.includes(c.name));

  if (missingColumns.length === 0) {
    return NextResponse.json({ 
      success: true, 
      message: 'All refund columns already exist',
      existingColumns: columns.map(c => c.name),
    });
  }

  // Since we can't run ALTER TABLE through the REST API,
  // we need to create a PostgreSQL function first, then call it
  // Alternative: Use the Supabase SQL Editor in the dashboard
  
  // Try to create the migration function via RPC
  // First, check if we have a migration function available
  const { error: rpcError } = await db.rpc('run_sql', { 
    sql: 'SELECT 1' 
  });

  if (rpcError) {
    // No RPC function available - provide SQL for manual execution
    const sqlStatements = [
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_details TEXT DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_bank_name VARCHAR(100) DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_bank_account VARCHAR(50) DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_account_name VARCHAR(255) DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reviewed_at TIMESTAMPTZ DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reviewed_by VARCHAR(255) DEFAULT NULL;',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_admin_note TEXT DEFAULT NULL;',
      "CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON orders(refund_status) WHERE refund_status IS NOT NULL;",
    ];

    return NextResponse.json({ 
      success: false,
      message: 'Cannot auto-migrate: no SQL execution function available. Please run the following SQL in Supabase Dashboard > SQL Editor:',
      missingColumns: missingColumns.map(c => c.name),
      sql: sqlStatements.join('\n'),
    }, { status: 200 });
  }

  // If RPC exists, run the migration
  const results: string[] = [];
  for (const col of missingColumns) {
    const sql = `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${col.name} TEXT DEFAULT NULL`;
    const { error } = await db.rpc('run_sql', { sql });
    if (error) {
      results.push(`FAILED: ${col.name} - ${error.message}`);
    } else {
      results.push(`OK: ${col.name}`);
    }
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Migration completed',
    results,
  });
}
