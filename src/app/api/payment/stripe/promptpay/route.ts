// src/app/api/payment/stripe/promptpay/route.ts
// Stripe PromptPay — custom QR flow (Direct API)
//
// POST: creates AND confirms a PaymentIntent server-side, returning the QR
//       code data (next_action.promptpay_display_qr_code) for the client to
//       render with its own UI.
// GET:  polls the intent status server-side (verified against Stripe with the
//       secret key) and marks the order PAID on success — so payment works
//       even without webhook delivery (e.g. localhost). The webhook remains
//       the authoritative production path.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, paymentTransactions } from '@/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { requireAuth, isResourceOwner, isAdminEmailAsync } from '@/lib/auth';
import {
  createStripePaymentIntentDetailed,
  isStripeEnvConfigured,
} from '@/lib/payment';
import { getStripePromptPayEnabled } from '@/lib/payment-server';
import { fetchStripeReceiptUrl, mergeStripeReceiptSlipData } from '@/lib/stripe-receipt';
import { sanitizeUtf8Input } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAID_STATUSES = ['PAID', 'READY', 'SHIPPED', 'RECEIVED', 'COMPLETED'];

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const userEmail = authResult.email;

  try {
    if (!isStripeEnvConfigured()) {
      return NextResponse.json(
        { status: 'error', message: 'Stripe PromptPay is not configured' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const ref = sanitizeUtf8Input(String(body?.ref || ''));
    if (!ref) {
      return NextResponse.json({ status: 'error', message: 'missing ref' }, { status: 400 });
    }

    const orderRows = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
    const order = orderRows[0];
    if (!order) {
      return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });
    }

    // Only the order owner (or an admin) can create a payment for it
    if (!isResourceOwner(order.customerEmail, userEmail) && !(await isAdminEmailAsync(userEmail))) {
      return NextResponse.json(
        { status: 'error', message: 'ไม่มีสิทธิ์ชำระเงินสำหรับคำสั่งซื้อนี้' },
        { status: 403 }
      );
    }

    if (PAID_STATUSES.includes(order.status) || order.paymentVerified) {
      return NextResponse.json(
        { status: 'error', message: 'คำสั่งซื้อนี้ชำระเงินแล้ว' },
        { status: 409 }
      );
    }

    // Check if there is an existing pending PromptPay transaction for this order created within the last 24 hours
    const existingTxRows = await db
      .select()
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.orderId, order.id),
        eq(paymentTransactions.method, 'promptpay'),
        eq(paymentTransactions.status, 'pending'),
        isNotNull(paymentTransactions.gatewayChargeId),
      ))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1);
    const existingTx = existingTxRows[0];

    if (existingTx && existingTx.gatewayChargeId) {
      const ageMs = Date.now() - new Date(existingTx.createdAt).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (ageMs < oneDayMs) {
        // Retrieve the PaymentIntent from Stripe using the secret key to ensure it hasn't been canceled
        const intentId = existingTx.gatewayChargeId;
        const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intentId}`, {
          headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
        });
        if (res.ok) {
          const intent = await res.json();
          // Only reuse intents that can still produce a PromptPay QR
          const reusable =
            intent.status === 'requires_payment_method' ||
            intent.status === 'requires_confirmation' ||
            intent.status === 'requires_action' ||
            intent.status === 'succeeded';
          if (intent.status !== 'canceled' && reusable) {
            console.log('[Stripe PromptPay] Reusing existing active PaymentIntent:', intent.id);
            
            // If the status has succeeded in Stripe, update the transaction and order immediately
            if (intent.status === 'succeeded' && existingTx.status !== 'paid') {
              const receiptUrl = await fetchStripeReceiptUrl(intentId);

              await db
                .update(paymentTransactions)
                .set({
                  status: 'paid',
                  gatewayTransactionId: intent.latest_charge || null,
                  verified: true,
                  verificationMethod: 'gateway',
                  verifiedAt: new Date(),
                  updatedAt: new Date(),
                  rawResponse: intent,
                })
                .where(eq(paymentTransactions.id, existingTx.id));

              const slipData = mergeStripeReceiptSlipData(order.slipData, receiptUrl);

              await db
                .update(orders)
                .set({
                  status: 'PAID',
                  paymentStatus: 'paid',
                  paymentMethod: 'promptpay',
                  paymentGateway: 'stripe',
                  paymentVerified: true,
                  paymentVerifiedAt: new Date().toISOString(),
                  receiptIssuedAt: new Date().toISOString(),
                  updatedAt: new Date(),
                  ...(slipData ? { slipData } : {}),
                })
                .where(eq(orders.id, order.id));
            }

            return NextResponse.json({
              status: 'success',
              data: {
                clientSecret: intent.client_secret,
                paymentIntentId: intent.id,
                amount: intent.amount / 100, // get amount from intent
                email: order.customerEmail,
                publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
                qrCode: intent.next_action?.promptpay_display_qr_code || null,
                intentStatus: intent.status,
              },
            });
          }
        }
      }
    }

    // Amount is always computed server-side from the order record
    const amountTHB = Number(order.totalAmount) || 0;
    if (amountTHB < 10) {
      // Stripe PromptPay minimum charge is 10 THB
      return NextResponse.json(
        { status: 'error', message: 'ยอดชำระต่ำกว่าขั้นต่ำของ PromptPay (10 บาท)' },
        { status: 400 }
      );
    }

    // Respect admin toggle + amount limits from Stripe settings
    if (!(await getStripePromptPayEnabled(amountTHB))) {
      return NextResponse.json(
        { status: 'error', message: 'ระบบชำระเงิน PromptPay ผ่าน Stripe ปิดใช้งานอยู่ชั่วคราว' },
        { status: 503 }
      );
    }

    // Create PaymentIntent WITHOUT confirm — server-side confirm+payment_method_data
    // frequently returns payment_method_not_available for PromptPay. Client confirms
    // via stripe.confirmPromptPayPayment(..., { handleActions: false }) to get the QR.
    const created = await createStripePaymentIntentDetailed({
      amount: Math.round(amountTHB * 100), // satang
      currency: 'thb',
      paymentMethodTypes: ['promptpay'],
      confirm: false,
      description: `Order ${ref}`,
      metadata: {
        orderId: ref,
        email: order.customerEmail,
      },
    });

    if (!created.ok) {
      const unavailable =
        created.code === 'payment_method_not_available' ||
        created.declineCode === 'payment_method_not_available';
      return NextResponse.json(
        {
          status: 'error',
          code: created.code || created.declineCode,
          message: unavailable
            ? 'พร้อมเพย์อัตโนมัติยังไม่พร้อมใช้งานตอนนี้ กรุณาเลือก “โอนเอง + แนบสลิป” หรือลองใหม่ภายหลัง'
            : created.message || 'สร้างรายการชำระเงินไม่สำเร็จ กรุณาลองใหม่',
        },
        { status: unavailable ? 503 : 502 },
      );
    }

    const intent = created.intent;

    // Record the pending transaction (webhook / poll flips it to paid)
    await db.insert(paymentTransactions).values({
      orderId: order.id,
      method: 'promptpay',
      gateway: 'stripe',
      amount: amountTHB,
      currency: 'THB',
      status: 'pending',
      gatewayChargeId: intent.id,
    });

    return NextResponse.json({
      status: 'success',
      data: {
        clientSecret: intent.clientSecret,
        paymentIntentId: intent.id,
        amount: amountTHB,
        email: order.customerEmail,
        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        // QR comes from client-side confirm (handleActions: false)
        qrCode: intent.nextAction?.promptpay_display_qr_code || null,
        intentStatus: intent.status,
      },
    });
  } catch (error: any) {
    console.error('[Stripe PromptPay] error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'failed to create payment' },
      { status: 500 }
    );
  }
}

// ==================== STATUS POLLING ====================

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const userEmail = authResult.email;

  try {
    const ref = sanitizeUtf8Input(req.nextUrl.searchParams.get('ref') || '');
    const intentId = sanitizeUtf8Input(req.nextUrl.searchParams.get('intent') || '');
    if (!ref || !intentId.startsWith('pi_')) {
      return NextResponse.json({ status: 'error', message: 'missing ref/intent' }, { status: 400 });
    }

    const orderRows = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
    const order = orderRows[0];
    if (!order) {
      return NextResponse.json({ status: 'error', message: 'order not found' }, { status: 404 });
    }
    if (!isResourceOwner(order.customerEmail, userEmail) && !(await isAdminEmailAsync(userEmail))) {
      return NextResponse.json({ status: 'error', message: 'forbidden' }, { status: 403 });
    }

    // The intent must be one we created for this order
    const txRows = await db
      .select({ id: paymentTransactions.id, status: paymentTransactions.status })
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.gatewayChargeId, intentId),
        eq(paymentTransactions.orderId, order.id),
      ))
      .limit(1);
    if (!txRows[0]) {
      return NextResponse.json({ status: 'error', message: 'unknown payment intent' }, { status: 404 });
    }

    // Verify the real status with Stripe using the secret key
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intentId}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });
    if (!res.ok) {
      return NextResponse.json({ status: 'error', message: 'stripe lookup failed' }, { status: 502 });
    }
    const intent = await res.json();

    // Mark paid (idempotent) — same effect as the webhook, but pull-based
    if (intent.status === 'succeeded' && txRows[0].status !== 'paid') {
      const receiptUrl = await fetchStripeReceiptUrl(intentId);

      await db
        .update(paymentTransactions)
        .set({
          status: 'paid',
          gatewayTransactionId: intent.latest_charge || null,
          verified: true,
          verificationMethod: 'gateway',
          verifiedAt: new Date(),
          updatedAt: new Date(),
          rawResponse: intent,
        })
        .where(eq(paymentTransactions.id, txRows[0].id));

      const slipData = mergeStripeReceiptSlipData(order.slipData, receiptUrl);

      await db
        .update(orders)
        .set({
          status: 'PAID',
          paymentStatus: 'paid',
          paymentMethod: 'promptpay',
          paymentGateway: 'stripe',
          paymentVerified: true,
          paymentVerifiedAt: new Date().toISOString(),
          receiptIssuedAt: new Date().toISOString(),
          updatedAt: new Date(),
          ...(slipData ? { slipData } : {}),
        })
        .where(eq(orders.id, order.id));

      console.log('[Stripe PromptPay] Poll detected payment success for order:', ref);
    }

    return NextResponse.json({
      status: 'success',
      data: { intentStatus: intent.status },
    });
  } catch (error: any) {
    console.error('[Stripe PromptPay] poll error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || 'poll failed' },
      { status: 500 }
    );
  }
}
