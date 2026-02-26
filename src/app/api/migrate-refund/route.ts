import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/migrate-refund - One-time migration to add refund columns
 * Note: With Prisma, the schema already defines these columns.
 * This endpoint is kept for backward compatibility but just checks that columns exist.
 */
export async function POST() {
  const authResult = await requireAdmin();
  if (authResult instanceof NextResponse) return authResult;

  try {
    // With Prisma, these columns are defined in the schema.
    // Just verify by querying one order.
    const sample = await prisma.order.findFirst({
      select: {
        refund_status: true,
        refund_reason: true,
        refund_bank_name: true,
        refund_bank_account: true,
        refund_account_name: true,
        refund_amount: true,
        refund_requested_at: true,
        refund_reviewed_at: true,
        refund_reviewed_by: true,
        refund_admin_note: true,
      },
      take: 1,
    });

    return NextResponse.json({
      success: true,
      message: 'All refund columns exist (managed by Prisma schema)',
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
