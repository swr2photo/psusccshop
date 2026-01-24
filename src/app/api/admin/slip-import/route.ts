// src/app/api/admin/slip-import/route.ts
// API สำหรับ import slip URL จาก SlipOK log เพื่อ backfill orders เก่า

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

interface SlipOKLogEntry {
  // จาก SlipOK export
  id?: string;
  transactionDate?: string;  // วันที่ทำรายการ
  slipDate?: string;         // วันที่ในสลิป
  amount?: number;
  receiver?: string;
  receiverAccount?: string;
  senderName?: string;
  senderBank?: string;
  senderAccount?: string;
  receiverName?: string;
  receiverBank?: string;
  imageUrl?: string;         // URL รูปสลิปจาก S3
  transRef?: string;         // เลขอ้างอิงธุรกรรม
}

// GET: ดู orders ที่ไม่มี slip data
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getSupabaseAdmin();
    
    // ดึง orders ที่เป็น PAID แต่ไม่มี slip_data หรือ slip_data ไม่มี imageUrl/base64
    const { data: orders, error } = await db
      .from('orders')
      .select('ref, status, total_amount, slip_data, created_at, customer_name')
      .eq('status', 'PAID')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Filter orders ที่ไม่มี slip image
    const ordersWithoutSlip = (orders || []).filter(o => {
      const slip = o.slip_data;
      return !slip || (!slip.imageUrl && !slip.base64);
    });

    // ดึง orders ที่มี slip data แล้ว (สำหรับ reference)
    const ordersWithSlip = (orders || []).filter(o => {
      const slip = o.slip_data;
      return slip && (slip.imageUrl || slip.base64);
    });

    return NextResponse.json({
      ordersWithoutSlip: ordersWithoutSlip.map(o => ({
        ref: o.ref,
        amount: o.total_amount,
        date: o.created_at,
        name: o.customer_name,
        hasSlipData: !!o.slip_data,
        slipTransRef: o.slip_data?.slipData?.transRef || null,
      })),
      ordersWithSlip: ordersWithSlip.map(o => ({
        ref: o.ref,
        amount: o.total_amount,
        date: o.created_at,
        hasImageUrl: !!o.slip_data?.imageUrl,
        hasBase64: !!o.slip_data?.base64,
        transRef: o.slip_data?.slipData?.transRef || null,
      })),
      summary: {
        totalPaid: orders?.length || 0,
        withoutSlip: ordersWithoutSlip.length,
        withSlip: ordersWithSlip.length,
      }
    });
  } catch (error: any) {
    console.error('[slip-import] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Import slip URLs จาก SlipOK log
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { slipokLogs, matchBy = 'transRef' } = body as {
      slipokLogs: SlipOKLogEntry[];
      matchBy?: 'transRef' | 'amount' | 'manual';
    };

    if (!slipokLogs || !Array.isArray(slipokLogs)) {
      return NextResponse.json({ error: 'slipokLogs array is required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    
    // ดึง orders ทั้งหมดที่เป็น PAID
    const { data: orders, error: fetchError } = await db
      .from('orders')
      .select('ref, status, total_amount, slip_data, created_at')
      .eq('status', 'PAID');

    if (fetchError) throw fetchError;

    const results: {
      matched: { orderRef: string; imageUrl: string; matchedBy: string }[];
      unmatched: SlipOKLogEntry[];
      alreadyHasImage: string[];
      errors: { orderRef: string; error: string }[];
    } = {
      matched: [],
      unmatched: [],
      alreadyHasImage: [],
      errors: [],
    };

    for (const log of slipokLogs) {
      if (!log.imageUrl) {
        results.unmatched.push(log);
        continue;
      }

      // หา order ที่ match
      let matchedOrder: typeof orders[0] | undefined;
      let matchedBy = '';

      if (matchBy === 'transRef' && log.transRef) {
        // Match โดย transRef ที่เก็บใน slip_data.slipData.transRef
        matchedOrder = orders?.find(o => 
          o.slip_data?.slipData?.transRef === log.transRef
        );
        matchedBy = `transRef: ${log.transRef}`;
      } else if (matchBy === 'amount' && log.amount) {
        // Match โดย amount (อาจ match หลาย orders)
        matchedOrder = orders?.find(o => 
          Math.abs(o.total_amount - log.amount!) < 1 && // tolerance 1 baht
          !o.slip_data?.imageUrl // ยังไม่มี imageUrl
        );
        matchedBy = `amount: ${log.amount}`;
      }

      if (!matchedOrder) {
        results.unmatched.push(log);
        continue;
      }

      // เช็คว่ามี imageUrl อยู่แล้วหรือไม่
      if (matchedOrder.slip_data?.imageUrl) {
        results.alreadyHasImage.push(matchedOrder.ref);
        continue;
      }

      // Update slip_data with imageUrl
      try {
        const updatedSlipData = {
          ...matchedOrder.slip_data,
          imageUrl: log.imageUrl,
          // เพิ่มข้อมูลจาก SlipOK log ถ้ายังไม่มี
          slipData: {
            ...matchedOrder.slip_data?.slipData,
            transRef: log.transRef || matchedOrder.slip_data?.slipData?.transRef,
            amount: log.amount || matchedOrder.slip_data?.slipData?.amount,
            senderName: log.senderName || matchedOrder.slip_data?.slipData?.senderName,
            senderBank: log.senderBank || matchedOrder.slip_data?.slipData?.senderBank,
            receiverName: log.receiverName || matchedOrder.slip_data?.slipData?.receiverName,
            receiverBank: log.receiverBank || matchedOrder.slip_data?.slipData?.receiverBank,
          },
          importedFromSlipOK: true,
          importedAt: new Date().toISOString(),
        };

        // ถ้ามี base64 ให้ลบออกเพื่อประหยัดพื้นที่ (เพราะมี imageUrl แล้ว)
        if (updatedSlipData.base64 && log.imageUrl) {
          delete updatedSlipData.base64;
        }

        const { error: updateError } = await db
          .from('orders')
          .update({ slip_data: updatedSlipData })
          .eq('ref', matchedOrder.ref);

        if (updateError) throw updateError;

        results.matched.push({
          orderRef: matchedOrder.ref,
          imageUrl: log.imageUrl,
          matchedBy,
        });
      } catch (err: any) {
        results.errors.push({
          orderRef: matchedOrder.ref,
          error: err.message,
        });
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

// PUT: Manual update - ระบุ orderRef และ imageUrl โดยตรง
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { updates } = body as {
      updates: { orderRef: string; imageUrl: string; slipData?: any }[];
    };

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const results: {
      success: string[];
      errors: { orderRef: string; error: string }[];
    } = {
      success: [],
      errors: [],
    };

    for (const update of updates) {
      if (!update.orderRef || !update.imageUrl) {
        results.errors.push({
          orderRef: update.orderRef || 'unknown',
          error: 'orderRef and imageUrl are required',
        });
        continue;
      }

      try {
        // ดึง order ปัจจุบัน
        const { data: order, error: fetchError } = await db
          .from('orders')
          .select('ref, slip_data')
          .eq('ref', update.orderRef)
          .single();

        if (fetchError || !order) {
          results.errors.push({
            orderRef: update.orderRef,
            error: 'Order not found',
          });
          continue;
        }

        // Update slip_data
        const updatedSlipData = {
          ...order.slip_data,
          imageUrl: update.imageUrl,
          slipData: {
            ...order.slip_data?.slipData,
            ...update.slipData,
          },
          importedFromSlipOK: true,
          importedAt: new Date().toISOString(),
        };

        // ลบ base64 ถ้ามี imageUrl
        if (updatedSlipData.base64) {
          delete updatedSlipData.base64;
        }

        const { error: updateError } = await db
          .from('orders')
          .update({ slip_data: updatedSlipData })
          .eq('ref', update.orderRef);

        if (updateError) throw updateError;

        results.success.push(update.orderRef);
      } catch (err: any) {
        results.errors.push({
          orderRef: update.orderRef,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: updates.length,
        success: results.success.length,
        errors: results.errors.length,
      },
    });
  } catch (error: any) {
    console.error('[slip-import] PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
