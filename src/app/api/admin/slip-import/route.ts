// src/app/api/admin/slip-import/route.ts
// API สำหรับ import slip URL จาก SlipOK log — Drizzle ORM

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

interface SlipOKLogEntry {
  id?: string;
  transactionDate?: string;
  slipDate?: string;
  amount?: number;
  receiver?: string;
  receiverAccount?: string;
  senderName?: string;
  senderBank?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverBank?: string;
  imageUrl?: string;
  transRef?: string;
}

// GET: ดู orders ที่ไม่มี slip data
export async function GET(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) return NextResponse.json('Unauthorized', { status: 401 });

    const fetchedOrders = await db.select({
      ref: orders.ref,
      status: orders.status,
      total_amount: orders.totalAmount,
      slip_data: orders.slipData,
      created_at: orders.createdAt,
      customer_name: orders.customerName,
    })
    .from(orders)
    .where(eq(orders.status, 'PAID'))
    .orderBy(desc(orders.createdAt))
    .limit(100);

    const ordersWithoutSlip = (fetchedOrders || []).filter((o: any) => {
      const slip = o.slip_data as any;
      return !slip || (!slip.imageUrl && !slip.base64);
    });

    const ordersWithSlip = (fetchedOrders || []).filter((o: any) => {
      const slip = o.slip_data as any;
      return slip && (slip.imageUrl || slip.base64);
    });

    return NextResponse.json({
      ordersWithoutSlip: ordersWithoutSlip.map((o: any) => ({
        ref: o.ref,
        amount: o.total_amount,
        date: o.created_at,
        name: o.customer_name,
        hasSlipData: !!o.slip_data,
        slipTransRef: (o.slip_data as any)?.slipData?.transRef || null,
      })),
      ordersWithSlip: ordersWithSlip.map((o: any) => ({
        ref: o.ref,
        amount: o.total_amount,
        date: o.created_at,
        hasImageUrl: !!(o.slip_data as any)?.imageUrl,
        hasBase64: !!(o.slip_data as any)?.base64,
        transRef: (o.slip_data as any)?.slipData?.transRef || null,
      })),
      summary: {
        totalPaid: fetchedOrders?.length || 0,
        withoutSlip: ordersWithoutSlip.length,
        withSlip: ordersWithSlip.length,
      },
    });
  } catch (error: any) {
    console.error('[slip-import] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import slip URLs จาก SlipOK log
export async function POST(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) return NextResponse.json('Unauthorized', { status: 401 });

    const body = await request.json();
    const { slipokLogs, matchBy = 'transRef' } = body as {
      slipokLogs: SlipOKLogEntry[];
      matchBy?: 'transRef' | 'amount' | 'manual';
    };

    if (!slipokLogs || !Array.isArray(slipokLogs)) {
      return NextResponse.json({ error: 'slipokLogs array is required' }, { status: 400 });
    }

    const fetchedOrders = await db.select({
      ref: orders.ref,
      status: orders.status,
      total_amount: orders.totalAmount,
      slip_data: orders.slipData,
      created_at: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.status, 'PAID'));

    const results: {
      matched: { orderRef: string; imageUrl: string; matchedBy: string }[];
      unmatched: SlipOKLogEntry[];
      alreadyHasImage: string[];
      errors: { orderRef: string; error: string }[];
    } = { matched: [], unmatched: [], alreadyHasImage: [], errors: [] };

    for (const log of slipokLogs) {
      if (!log.imageUrl) { results.unmatched.push(log); continue; }

      let matchedOrder: typeof fetchedOrders[0] | undefined;
      let matchedBy = '';

      if (matchBy === 'transRef' && log.transRef) {
        matchedOrder = fetchedOrders?.find((o: any) => (o.slip_data as any)?.slipData?.transRef === log.transRef);
        matchedBy = `transRef: ${log.transRef}`;
      } else if (matchBy === 'amount' && log.amount) {
        matchedOrder = fetchedOrders?.find((o: any) =>
          Math.abs((o.total_amount || 0) - log.amount!) < 1 && !(o.slip_data as any)?.imageUrl
        );
        matchedBy = `amount: ${log.amount}`;
      }

      if (!matchedOrder) { results.unmatched.push(log); continue; }
      if ((matchedOrder.slip_data as any)?.imageUrl) { results.alreadyHasImage.push(matchedOrder.ref); continue; }

      try {
        const existingSlip = (matchedOrder.slip_data as any) || {};
        const updatedSlipData: any = {
          ...existingSlip,
          imageUrl: log.imageUrl,
          slipData: {
            ...existingSlip.slipData,
            transRef: log.transRef || existingSlip.slipData?.transRef,
            amount: log.amount || existingSlip.slipData?.amount,
            senderName: log.senderName || existingSlip.slipData?.senderName,
            senderBank: log.senderBank || existingSlip.slipData?.senderBank,
            receiverName: log.receiverName || existingSlip.slipData?.receiverName,
            receiverBank: log.receiverBank || existingSlip.slipData?.receiverBank,
          },
          importedFromSlipOK: true,
          importedAt: new Date().toISOString(),
        };
        if (updatedSlipData.base64 && log.imageUrl) delete updatedSlipData.base64;

        await db.update(orders)
          .set({ slipData: updatedSlipData, updatedAt: new Date() })
          .where(eq(orders.ref, matchedOrder.ref));

        results.matched.push({ orderRef: matchedOrder.ref, imageUrl: log.imageUrl, matchedBy });
      } catch (err: any) {
        results.errors.push({ orderRef: matchedOrder.ref, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: slipokLogs.length,
        matched: results.matched.length,
        unmatched: results.unmatched.length,
        alreadyHasImage: results.alreadyHasImage.length,
        errors: results.errors.length,
      },
    });
  } catch (error: any) {
    console.error('[slip-import] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Manual update
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    if (!admin) return NextResponse.json('Unauthorized', { status: 401 });

    const body = await request.json();
    const { updates } = body as { updates: { orderRef: string; imageUrl: string; slipData?: any }[] };

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
    }

    const results: { success: string[]; errors: { orderRef: string; error: string }[] } = {
      success: [], errors: [],
    };

    for (const update of updates) {
      if (!update.orderRef || !update.imageUrl) {
        results.errors.push({ orderRef: update.orderRef || 'unknown', error: 'orderRef and imageUrl are required' });
        continue;
      }

      try {
        const orderResults = await db.select({
          ref: orders.ref,
          slip_data: orders.slipData,
        })
        .from(orders)
        .where(eq(orders.ref, update.orderRef))
        .limit(1);

        const order = orderResults[0];

        if (!order) { results.errors.push({ orderRef: update.orderRef, error: 'Order not found' }); continue; }

        const existingSlip = (order.slip_data as any) || {};
        const updatedSlipData: any = {
          ...existingSlip,
          imageUrl: update.imageUrl,
          slipData: { ...existingSlip.slipData, ...update.slipData },
          importedFromSlipOK: true,
          importedAt: new Date().toISOString(),
        };
        if (updatedSlipData.base64) delete updatedSlipData.base64;

        await db.update(orders)
          .set({ slipData: updatedSlipData, updatedAt: new Date() })
          .where(eq(orders.ref, update.orderRef));

        results.success.push(update.orderRef);
      } catch (err: any) {
        results.errors.push({ orderRef: update.orderRef, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: { total: updates.length, success: results.success.length, errors: results.errors.length },
    });
  } catch (error: any) {
    console.error('[slip-import] PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

