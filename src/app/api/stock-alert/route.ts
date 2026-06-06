// API route for back-in-stock alerts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stockAlerts } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// POST /api/stock-alert - Register for back-in-stock alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, email, size } = body;

    if (!productId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailHash = hashEmail(email);
    const sizeVal = size || null;

    // Upsert stock alert
    const existing = await db
      .select()
      .from(stockAlerts)
      .where(
        and(
          eq(stockAlerts.productId, productId),
          eq(stockAlerts.emailHash, emailHash),
          sizeVal ? eq(stockAlerts.size, sizeVal) : isNull(stockAlerts.size)
        )
      )
      .limit(1);

    let resultData;
    if (existing.length > 0) {
      const updated = await db
        .update(stockAlerts)
        .set({
          notified: false,
        })
        .where(eq(stockAlerts.id, existing[0].id))
        .returning();
      resultData = updated[0];
    } else {
      const inserted = await db
        .insert(stockAlerts)
        .values({
          productId,
          emailHash,
          size: sizeVal,
          notified: false,
          createdAt: new Date(),
        })
        .returning();
      resultData = inserted[0];
    }

    return NextResponse.json({ success: true, alert: resultData });
  } catch (error: any) {
    console.error('POST /api/stock-alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/stock-alert - Unsubscribe from alert
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, email } = body;

    if (!productId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    await db
      .delete(stockAlerts)
      .where(
        and(
          eq(stockAlerts.productId, productId),
          eq(stockAlerts.emailHash, emailHash)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/stock-alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/stock-alert?email=xxx - Get user's active alerts
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    const emailHash = hashEmail(email);

    const data = await db
      .select()
      .from(stockAlerts)
      .where(
        and(
          eq(stockAlerts.emailHash, emailHash),
          eq(stockAlerts.notified, false)
        )
      );

    return NextResponse.json({
      alerts: (data || []).map((a: any) => ({
        productId: a.productId,
        size: a.size,
        createdAt: a.createdAt?.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('GET /api/stock-alert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
