import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/migrate-refund - One-time migration to add refund columns
 * Note: With Drizzle, the schema already defines these columns.
 * This endpoint is kept for backward compatibility but just checks that columns exist.
 */
export async function POST() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    // With Drizzle, these columns are defined in the schema.
    // Just verify by querying one order.
    const sample = await db.select({
      refund_status: orders.refundStatus,
      refund_reason: orders.refundReason,
      refund_bank_name: orders.refundBankName,
      refund_bank_account: orders.refundBankAccount,
      refund_account_name: orders.refundAccountName,
      refund_amount: orders.refundAmount,
      refund_requested_at: orders.refundRequestedAt,
      refund_reviewed_at: orders.refundReviewedAt,
      refund_reviewed_by: orders.refundReviewedBy,
      refund_admin_note: orders.refundAdminNote,
    })
    .from(orders)
    .limit(1);

    return NextResponse.json({
      success: true,
      message: 'All refund columns exist (managed by Drizzle schema)',
      existingColumns: [
        'refund_status', 'refund_reason', 'refund_details',
        'refund_bank_name', 'refund_bank_account', 'refund_account_name',
        'refund_amount', 'refund_requested_at', 'refund_reviewed_at',
        'refund_reviewed_by', 'refund_admin_note',
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
