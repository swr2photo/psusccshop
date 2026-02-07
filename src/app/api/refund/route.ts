import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, requireAdminWithPermission, isResourceOwner } from '@/lib/auth';
import { getOrderByRef } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase';
import { triggerSheetSync } from '@/lib/sheet-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Refund reasons that are allowed
const REFUND_REASONS = [
  'สินค้ามีปัญหา/ชำรุด',
  'สินค้าไม่ตรงตามที่สั่ง',
  'ไม่สามารถเข้าร่วมค่าย/กิจกรรมได้',
  'เปลี่ยนใจ',
  'อื่นๆ',
];

// Statuses eligible for refund request
const REFUNDABLE_STATUSES = ['PAID', 'READY', 'COMPLETED', 'SHIPPED'];

// Thai bank list
const THAI_BANKS = [
  'ธนาคารกสิกรไทย',
  'ธนาคารกรุงเทพ',
  'ธนาคารกรุงไทย',
  'ธนาคารไทยพาณิชย์',
  'ธนาคารกรุงศรีอยุธยา',
  'ธนาคารทหารไทยธนชาต',
  'ธนาคารออมสิน',
  'ธนาคารเกียรตินาคินภัทร',
  'ธนาคารซีไอเอ็มบี ไทย',
  'ธนาคารยูโอบี',
  'ธนาคารแลนด์ แอนด์ เฮ้าส์',
  'ธนาคารทิสโก้',
  'พร้อมเพย์',
  'อื่นๆ',
];

// ==================== COLUMN DETECTION ====================
// Auto-detect whether refund columns exist in the database.
// Falls back to storing refund data as JSON in the `notes` column.

let _hasRefundColumns: boolean | null = null;

async function hasRefundColumns(): Promise<boolean> {
  if (_hasRefundColumns !== null) return _hasRefundColumns;
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from('orders').select('refund_status').limit(1);
  _hasRefundColumns = !error || error.code !== '42703';
  return _hasRefundColumns;
}

// ==================== REFUND DATA HELPERS ====================

interface RefundData {
  status: string;
  reason: string;
  details?: string;
  bankName: string;
  bankAccount: string;
  accountName: string;
  amount: number;
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
}

const REFUND_TAG = '[REFUND_DATA]';

function extractRefundFromNotes(notes: string | null | undefined): RefundData | null {
  if (!notes) return null;
  try {
    const idx = notes.indexOf(REFUND_TAG);
    if (idx !== -1) {
      return JSON.parse(notes.slice(idx + REFUND_TAG.length));
    }
  } catch { /* ignore */ }
  return null;
}

function buildNotesWithRefund(originalNotes: string | null | undefined, refund: RefundData): string {
  const clean = (originalNotes || '').replace(/\[REFUND_DATA\][\s\S]*$/, '').trim();
  return (clean ? clean + '\n' : '') + REFUND_TAG + JSON.stringify(refund);
}

/** Unified refund info extraction – works with both column and notes storage */
function getRefundInfo(order: any): { refundStatus: string | null; refundData: RefundData | null } {
  // 1) Dedicated columns (via transformDBOrderToLegacy mapping)
  if (order.refundStatus) {
    return {
      refundStatus: order.refundStatus,
      refundData: {
        status: order.refundStatus,
        reason: order.refundReason || '',
        details: order.refundDetails,
        bankName: order.refundBankName || '',
        bankAccount: order.refundBankAccount || '',
        accountName: order.refundAccountName || '',
        amount: order.refundAmount || 0,
        requestedAt: order.refundRequestedAt || '',
        reviewedAt: order.refundReviewedAt,
        reviewedBy: order.refundReviewedBy,
        adminNote: order.refundAdminNote,
      },
    };
  }
  // 2) Notes fallback
  const fromNotes = extractRefundFromNotes(order.notes);
  if (fromNotes) return { refundStatus: fromNotes.status, refundData: fromNotes };
  return { refundStatus: null, refundData: null };
}

// ==================== API HANDLERS ====================

/**
 * GET /api/refund - Get refund request info for a specific order, or list all (admin)
 */
export async function GET(req: NextRequest) {
  const isAdminQuery = req.nextUrl.searchParams.get('admin') === 'true';
  const useColumns = await hasRefundColumns();

  if (isAdminQuery) {
    const adminAuth = await requireAdminWithPermission('canManageRefunds');
    if (adminAuth instanceof NextResponse) return adminAuth;

    try {
      const supabase = getSupabaseAdmin();
      if (!supabase) throw new Error('Database not available');

      let data: any[];

      if (useColumns) {
        const result = await supabase
          .from('orders')
          .select('*')
          .not('refund_status', 'is', null)
          .order('refund_requested_at', { ascending: false });
        if (result.error) throw result.error;
        data = result.data || [];
      } else {
        // Fallback: scan notes for refund data
        const result = await supabase
          .from('orders')
          .select('*')
          .like('notes', '%[REFUND_DATA]%')
          .order('updated_at', { ascending: false });
        if (result.error) throw result.error;
        data = result.data || [];
      }

      const orders = data.map((o: Record<string, any>) => {
        const refundFromNotes = extractRefundFromNotes(o.notes as string);
        const refund = o.refund_status
          ? {
              status: o.refund_status,
              reason: o.refund_reason,
              details: o.refund_details,
              bankName: o.refund_bank_name,
              bankAccount: o.refund_bank_account,
              accountName: o.refund_account_name,
              amount: o.refund_amount,
              requestedAt: o.refund_requested_at,
              reviewedAt: o.refund_reviewed_at,
              reviewedBy: o.refund_reviewed_by,
              adminNote: o.refund_admin_note,
            }
          : refundFromNotes;

        return {
          ref: o.ref,
          status: o.status,
          total: o.total_amount || 0,
          date: o.created_at,
          customerName: o.customer_name,
          customerEmail: o.customer_email,
          items: (() => { try { return typeof o.cart === 'string' ? JSON.parse(o.cart) : o.cart; } catch { return []; } })(),
          refundStatus: refund?.status || null,
          refundReason: refund?.reason || null,
          refundDetails: refund?.details || null,
          refundBankName: refund?.bankName || null,
          refundBankAccount: refund?.bankAccount || null,
          refundAccountName: refund?.accountName || null,
          refundAmount: refund?.amount || null,
          refundRequestedAt: refund?.requestedAt || null,
          refundReviewedAt: refund?.reviewedAt || null,
          refundReviewedBy: refund?.reviewedBy || null,
          refundAdminNote: refund?.adminNote || null,
        };
      });

      return NextResponse.json({ orders });
    } catch (error: any) {
      console.error('[Refund API] Admin list error:', error);
      return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
    }
  }

  // Regular user: get refund info for a specific order
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref) {
    return NextResponse.json({ error: 'Missing ref parameter' }, { status: 400 });
  }

  try {
    const order = await getOrderByRef(ref);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!isResourceOwner(order.customerEmail, authResult.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { refundStatus, refundData } = getRefundInfo(order);

    return NextResponse.json({
      ref: order.ref,
      status: order.status,
      totalAmount: order.totalAmount || order.amount,
      refund: refundData
        ? {
            status: refundData.status,
            reason: refundData.reason,
            details: refundData.details,
            amount: refundData.amount,
            bankName: refundData.bankName,
            bankAccount: refundData.bankAccount,
            accountName: refundData.accountName,
            requestedAt: refundData.requestedAt,
            reviewedAt: refundData.reviewedAt,
            adminNote: refundData.adminNote,
          }
        : null,
      canRequestRefund: REFUNDABLE_STATUSES.includes((order.status || '').toUpperCase()) && !refundStatus,
      reasons: REFUND_REASONS,
      banks: THAI_BANKS,
    });
  } catch (error: any) {
    console.error('[Refund API] GET error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/refund - Submit a refund request
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { ref, reason, details, bankName, bankAccount, accountName, amount } = body;

    if (!ref || !reason || !bankName || !bankAccount || !accountName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const order = await getOrderByRef(ref);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!isResourceOwner(order.customerEmail, authResult.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderStatus = (order.status || '').toUpperCase();
    if (!REFUNDABLE_STATUSES.includes(orderStatus)) {
      return NextResponse.json({
        error: 'คำสั่งซื้อนี้ไม่สามารถขอคืนเงินได้ (สถานะไม่อนุญาต)',
      }, { status: 400 });
    }

    // Check existing refund (both column + notes)
    const { refundStatus: existingRefund } = getRefundInfo(order);
    if (existingRefund) {
      return NextResponse.json({ error: 'คุณได้ส่งคำขอคืนเงินไปแล้ว' }, { status: 400 });
    }

    const orderTotal = order.totalAmount || order.amount || 0;
    const refundAmount = amount ? Math.min(Number(amount), orderTotal) : orderTotal;
    if (refundAmount <= 0) {
      return NextResponse.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) throw new Error('Database not available');

    const useColumns = await hasRefundColumns();
    const refundData: RefundData = {
      status: 'REQUESTED',
      reason,
      details: details || undefined,
      bankName,
      bankAccount,
      accountName,
      amount: refundAmount,
      requestedAt: new Date().toISOString(),
    };

    if (useColumns) {
      const { error: updateError } = await db
        .from('orders')
        .update({
          refund_status: 'REQUESTED',
          refund_reason: reason,
          refund_details: details || null,
          refund_bank_name: bankName,
          refund_bank_account: bankAccount,
          refund_account_name: accountName,
          refund_amount: refundAmount,
          refund_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('ref', ref);
      if (updateError) throw updateError;
    } else {
      // Fallback: store in notes column
      const newNotes = buildNotesWithRefund(order.notes, refundData);
      const { error: updateError } = await db
        .from('orders')
        .update({ notes: newNotes, updated_at: new Date().toISOString() })
        .eq('ref', ref);
      if (updateError) throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งคำขอคืนเงินเรียบร้อยแล้ว รอการตรวจสอบจากแอดมิน',
      refundStatus: 'REQUESTED',
    });
  } catch (error: any) {
    console.error('[Refund API] POST error:', error);
    const message = error?.message || error?.details || 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/refund - Admin: approve/reject/complete refund
 */
export async function PUT(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManageRefunds');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { ref, action, adminNote } = body;

    if (!ref || !action) {
      return NextResponse.json({ error: 'Missing ref or action' }, { status: 400 });
    }

    if (!['approve', 'reject', 'complete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const order = await getOrderByRef(ref);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { refundStatus, refundData } = getRefundInfo(order);

    // Validate status transitions
    let newRefundStatus: string;
    let newOrderStatus: string | undefined;

    switch (action) {
      case 'approve':
        if (refundStatus !== 'REQUESTED') {
          return NextResponse.json({ error: 'ไม่สามารถอนุมัติได้ สถานะไม่ถูกต้อง' }, { status: 400 });
        }
        newRefundStatus = 'APPROVED';
        break;
      case 'reject':
        if (!['REQUESTED', 'APPROVED'].includes(refundStatus || '')) {
          return NextResponse.json({ error: 'ไม่สามารถปฏิเสธได้ สถานะไม่ถูกต้อง' }, { status: 400 });
        }
        newRefundStatus = 'REJECTED';
        break;
      case 'complete':
        if (refundStatus !== 'APPROVED') {
          return NextResponse.json({ error: 'ต้องอนุมัติก่อนจึงจะคืนเงินได้' }, { status: 400 });
        }
        newRefundStatus = 'COMPLETED';
        newOrderStatus = 'REFUNDED';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    if (!db) throw new Error('Database not available');

    const useColumns = await hasRefundColumns();

    if (useColumns) {
      const updateData: any = {
        refund_status: newRefundStatus,
        refund_reviewed_at: new Date().toISOString(),
        refund_reviewed_by: authResult.email,
        refund_admin_note: adminNote || null,
        updated_at: new Date().toISOString(),
      };
      if (newOrderStatus) updateData.status = newOrderStatus;

      const { error: updateError } = await db.from('orders').update(updateData).eq('ref', ref);
      if (updateError) throw updateError;
    } else {
      // Fallback: update refund data in notes
      const updatedRefund: RefundData = {
        ...(refundData || { status: '', reason: '', bankName: '', bankAccount: '', accountName: '', amount: 0, requestedAt: '' }),
        status: newRefundStatus,
        reviewedAt: new Date().toISOString(),
        reviewedBy: authResult.email,
        adminNote: adminNote || undefined,
      };
      const newNotes = buildNotesWithRefund(order.notes, updatedRefund);
      const updateData: any = { notes: newNotes, updated_at: new Date().toISOString() };
      if (newOrderStatus) updateData.status = newOrderStatus;

      const { error: updateError } = await db.from('orders').update(updateData).eq('ref', ref);
      if (updateError) throw updateError;
    }

    if (action === 'complete') {
      triggerSheetSync().catch(() => {});
    }

    const actionLabels: Record<string, string> = {
      approve: 'อนุมัติคำขอคืนเงิน',
      reject: 'ปฏิเสธคำขอคืนเงิน',
      complete: 'คืนเงินเรียบร้อย',
    };

    return NextResponse.json({
      success: true,
      message: actionLabels[action],
      refundStatus: newRefundStatus,
    });
  } catch (error: any) {
    console.error('[Refund API] PUT error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
