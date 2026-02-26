import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin, requireAdminWithPermission, isResourceOwner } from '@/lib/auth';
import { getOrderByRef } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { triggerSheetSync } from '@/lib/sheet-sync';
import { sendPushNotification } from '@/lib/push-notification';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REFUND_REASONS = [
  'สินค้ามีปัญหา/ชำรุด',
  'สินค้าไม่ตรงตามที่สั่ง',
  'ไม่สามารถเข้าร่วมค่าย/กิจกรรมได้',
  'เปลี่ยนใจ',
  'อื่นๆ',
];

const REFUNDABLE_STATUSES = ['PAID', 'READY', 'COMPLETED', 'SHIPPED'];

const THAI_BANKS = [
  'ธนาคารกสิกรไทย', 'ธนาคารกรุงเทพ', 'ธนาคารกรุงไทย',
  'ธนาคารไทยพาณิชย์', 'ธนาคารกรุงศรีอยุธยา', 'ธนาคารทหารไทยธนชาต',
  'ธนาคารออมสิน', 'ธนาคารเกียรตินาคินภัทร', 'ธนาคารซีไอเอ็มบี ไทย',
  'ธนาคารยูโอบี', 'ธนาคารแลนด์ แอนด์ เฮ้าส์', 'ธนาคารทิสโก้',
  'พร้อมเพย์', 'อื่นๆ',
];

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
    if (idx !== -1) return JSON.parse(notes.slice(idx + REFUND_TAG.length));
  } catch { /* ignore */ }
  return null;
}

function buildNotesWithRefund(originalNotes: string | null | undefined, refund: RefundData): string {
  const clean = (originalNotes || '').replace(/\[REFUND_DATA\][\s\S]*$/, '').trim();
  return (clean ? clean + '\n' : '') + REFUND_TAG + JSON.stringify(refund);
}

function getRefundInfo(order: any): { refundStatus: string | null; refundData: RefundData | null } {
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
  const fromNotes = extractRefundFromNotes(order.notes);
  if (fromNotes) return { refundStatus: fromNotes.status, refundData: fromNotes };
  return { refundStatus: null, refundData: null };
}

// ==================== API HANDLERS ====================

export async function GET(req: NextRequest) {
  const isAdminQuery = req.nextUrl.searchParams.get('admin') === 'true';
  const shopId = req.nextUrl.searchParams.get('shopId');

  if (isAdminQuery) {
    const adminAuth = await requireAdminWithPermission('canManageRefunds');
    if (adminAuth instanceof NextResponse) return adminAuth;

    try {
      const where: any = {
        refund_status: { not: null },
      };
      if (shopId) where.shop_id = shopId;

      const data = await prisma.order.findMany({
        where,
        orderBy: { refund_requested_at: 'desc' },
      });

      const orders = (data || []).map((o: any) => {
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

  // Regular user
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const ref = req.nextUrl.searchParams.get('ref');
  if (!ref) return NextResponse.json({ error: 'Missing ref parameter' }, { status: 400 });

  try {
    const order = await getOrderByRef(ref);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!isResourceOwner(order.customerEmail, authResult.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { refundStatus, refundData } = getRefundInfo(order);
    return NextResponse.json({
      ref: order.ref,
      status: order.status,
      totalAmount: order.totalAmount || order.amount,
      refund: refundData ? {
        status: refundData.status, reason: refundData.reason,
        details: refundData.details, amount: refundData.amount,
        bankName: refundData.bankName, bankAccount: refundData.bankAccount,
        accountName: refundData.accountName, requestedAt: refundData.requestedAt,
        reviewedAt: refundData.reviewedAt, adminNote: refundData.adminNote,
      } : null,
      canRequestRefund: REFUNDABLE_STATUSES.includes((order.status || '').toUpperCase()) && !refundStatus,
      reasons: REFUND_REASONS,
      banks: THAI_BANKS,
    });
  } catch (error: any) {
    console.error('[Refund API] GET error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

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
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!isResourceOwner(order.customerEmail, authResult.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderStatus = (order.status || '').toUpperCase();
    if (!REFUNDABLE_STATUSES.includes(orderStatus)) {
      return NextResponse.json({ error: 'คำสั่งซื้อนี้ไม่สามารถขอคืนเงินได้ (สถานะไม่อนุญาต)' }, { status: 400 });
    }

    const { refundStatus: existingRefund } = getRefundInfo(order);
    if (existingRefund) {
      return NextResponse.json({ error: 'คุณได้ส่งคำขอคืนเงินไปแล้ว' }, { status: 400 });
    }

    const orderTotal = order.totalAmount || order.amount || 0;
    const refundAmount = amount ? Math.min(Number(amount), orderTotal) : orderTotal;
    if (refundAmount <= 0) {
      return NextResponse.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, { status: 400 });
    }

    await prisma.order.update({
      where: { ref },
      data: {
        refund_status: 'REQUESTED',
        refund_reason: reason,
        refund_details: details || null,
        refund_bank_name: bankName,
        refund_bank_account: bankAccount,
        refund_account_name: accountName,
        refund_amount: refundAmount,
        refund_requested_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'ส่งคำขอคืนเงินเรียบร้อยแล้ว รอการตรวจสอบจากแอดมิน',
      refundStatus: 'REQUESTED',
    });
  } catch (error: any) {
    console.error('[Refund API] POST error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const authResult = await requireAdminWithPermission('canManageRefunds');
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await req.json();
    const { ref, action, adminNote } = body;

    if (!ref || !action) return NextResponse.json({ error: 'Missing ref or action' }, { status: 400 });
    if (!['approve', 'reject', 'complete'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const order = await getOrderByRef(ref);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const { refundStatus } = getRefundInfo(order);
    let newRefundStatus: string;
    let newOrderStatus: string | undefined;

    switch (action) {
      case 'approve':
        if (refundStatus !== 'REQUESTED') return NextResponse.json({ error: 'ไม่สามารถอนุมัติได้' }, { status: 400 });
        newRefundStatus = 'APPROVED';
        break;
      case 'reject':
        if (!['REQUESTED', 'APPROVED'].includes(refundStatus || '')) return NextResponse.json({ error: 'ไม่สามารถปฏิเสธได้' }, { status: 400 });
        newRefundStatus = 'REJECTED';
        break;
      case 'complete':
        if (refundStatus !== 'APPROVED') return NextResponse.json({ error: 'ต้องอนุมัติก่อน' }, { status: 400 });
        newRefundStatus = 'COMPLETED';
        newOrderStatus = 'REFUNDED';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updateData: any = {
      refund_status: newRefundStatus,
      refund_reviewed_at: new Date(),
      refund_reviewed_by: authResult.email,
      refund_admin_note: adminNote || null,
    };
    if (newOrderStatus) updateData.status = newOrderStatus;

    await prisma.order.update({ where: { ref }, data: updateData });

    if (action === 'complete') triggerSheetSync().catch(() => {});

    const customerEmail = order.customerEmail;
    if (customerEmail) {
      const pushMessages: Record<string, { title: string; body: string }> = {
        approve: { title: 'คำขอคืนเงินได้รับการอนุมัติ', body: `ออเดอร์ ${ref} ได้รับการอนุมัติแล้ว` },
        reject: { title: 'คำขอคืนเงินถูกปฏิเสธ', body: `ออเดอร์ ${ref} ถูกปฏิเสธ${adminNote ? ` — ${adminNote}` : ''}` },
        complete: { title: 'คืนเงินเรียบร้อยแล้ว', body: `ออเดอร์ ${ref} คืนเงินแล้ว กรุณาตรวจสอบบัญชี` },
      };
      const msg = pushMessages[action];
      if (msg) sendPushNotification(customerEmail, { ...msg, icon: '/icon-192.png', url: '/', tag: `refund-${ref}` }).catch(() => {});
    }

    const actionLabels: Record<string, string> = {
      approve: 'อนุมัติคำขอคืนเงิน',
      reject: 'ปฏิเสธคำขอคืนเงิน',
      complete: 'คืนเงินเรียบร้อย',
    };

    return NextResponse.json({ success: true, message: actionLabels[action], refundStatus: newRefundStatus });
  } catch (error: any) {
    console.error('[Refund API] PUT error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
