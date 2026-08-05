// src/app/api/payment/stripe/card/route.ts
// Stripe Credit/Debit Card Payment API

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, paymentTransactions } from '@/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { getSession, isResourceOwner, isAdminEmailAsync } from '@/lib/auth';
import {
  createStripePaymentIntentDetailed,
  isStripeEnvConfigured,
  getStripeCardEnabled,
} from '@/lib/payment-server';
import { fetchStripeReceiptUrl, mergeStripeReceiptSlipData } from '@/lib/stripe-receipt';
import { sanitizeUtf8Input } from '@/lib/sanitize';
import { secureJsonRequest, secureJsonResponse } from '@/lib/payload-crypto';
import { sendPaymentReceivedEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAID_STATUSES = ['PAID', 'READY', 'SHIPPED', 'RECEIVED', 'COMPLETED'];

/**
 * POST: Create a PaymentIntent for Credit/Debit Card payment
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  const userEmail = session?.user?.email || null;

  try {
    if (!isStripeEnvConfigured()) {
      return await secureJsonResponse(
        { status: 'error', message: 'Stripe Card Payment is not configured' },
        { status: 503 }
      );
    }

    const body = await secureJsonRequest(req);
    const ref = sanitizeUtf8Input(String(body?.ref || ''));
    if (!ref) {
      return await secureJsonResponse({ status: 'error', message: 'missing ref' }, { status: 400 });
    }

    const orderRows = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
    const order = orderRows[0];
    if (!order) {
      return await secureJsonResponse({ status: 'error', message: 'order not found' }, { status: 404 });
    }

    // Check order status
    const currentStatus = (order.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED' || currentStatus === 'EXPIRED') {
      return await secureJsonResponse(
        { status: 'error', message: 'คำสั่งซื้อนี้ถูกยกเลิกหรือหมดอายุแล้ว' },
        { status: 400 }
      );
    }

    if (userEmail && order.customerEmail) {
      const isOwner = isResourceOwner(order.customerEmail, userEmail);
      const isAdmin = await isAdminEmailAsync(userEmail);
      if (!isOwner && !isAdmin) {
        return await secureJsonResponse(
          { status: 'error', message: 'ไม่มีสิทธิ์ชำระเงินสำหรับคำสั่งซื้อนี้' },
          { status: 403 }
        );
      }
    }

    if (PAID_STATUSES.includes(currentStatus) || order.paymentVerified) {
      return await secureJsonResponse(
        { status: 'error', message: 'คำสั่งซื้อนี้ชำระเงินแล้ว' },
        { status: 409 }
      );
    }

    const amountTHB = Number(order.totalAmount ?? (order as any).amount ?? 0);
    if (!amountTHB || amountTHB < 10) {
      return await secureJsonResponse(
        { status: 'error', message: 'ยอดชำระขั้นต่ำสำหรับบัตรเครดิต/เดบิตคือ 10 บาท' },
        { status: 400 }
      );
    }

    if (!(await getStripeCardEnabled(amountTHB))) {
      return await secureJsonResponse(
        { status: 'error', message: 'การชำระเงินด้วยบัตรเครดิต/เดบิต ไม่พร้อมใช้งานชั่วคราว' },
        { status: 403 }
      );
    }

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

    // Check if there is an existing pending card transaction for this order
    const existingTxRows = await db
      .select()
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.orderId, order.id),
        eq(paymentTransactions.method, 'credit_card'),
        eq(paymentTransactions.status, 'pending'),
        isNotNull(paymentTransactions.gatewayChargeId),
      ))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1);
    const existingTx = existingTxRows[0];

    if (existingTx && existingTx.gatewayChargeId) {
      const intentId = existingTx.gatewayChargeId;
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intentId}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      });

      if (res.ok) {
        const intent = await res.json();
        if (intent.status !== 'canceled' && intent.client_secret) {
          return await secureJsonResponse({
            status: 'success',
            clientSecret: intent.client_secret,
            publishableKey,
            intentId: intent.id,
            amount: amountTHB,
          });
        }
      }
    }

    // Create new PaymentIntent for Card
    const result = await createStripePaymentIntentDetailed({
      amount: Math.round(amountTHB * 100), // Stripe expects satang
      currency: 'thb',
      paymentMethodTypes: ['card'],
      description: `PSU SCC Shop Order #${order.ref}`,
      metadata: {
        orderRef: order.ref,
        customerEmail: order.customerEmail || userEmail,
        shopId: order.shopId || '',
      },
    });

    if (!result.ok || !result.intent?.clientSecret) {
      const errMessage = !result.ok && 'message' in result ? result.message : undefined;
      return await secureJsonResponse(
        { status: 'error', message: errMessage || 'ไม่สามารถสร้างรายการชำระเงินด้วยบัตรได้' },
        { status: 500 }
      );
    }

    await db.insert(paymentTransactions).values({
      orderId: order.id,
      method: 'credit_card',
      amount: amountTHB,
      status: 'pending',
      gateway: 'stripe',
      gatewayChargeId: result.intent.id,
    });

    return await secureJsonResponse({
      status: 'success',
      clientSecret: result.intent.clientSecret,
      publishableKey,
      intentId: result.intent.id,
      amount: amountTHB,
    });
  } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Stripe Card POST] Error:', err);
    return await secureJsonResponse(
      { status: 'error', message: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET: Poll and verify Stripe PaymentIntent status server-side
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  const userEmail = session?.user?.email || null;

  try {
    const ref = req.nextUrl.searchParams.get('ref');
    if (!ref) {
      return await secureJsonResponse({ status: 'error', message: 'missing ref' }, { status: 400 });
    }

    const orderRows = await db.select().from(orders).where(eq(orders.ref, ref)).limit(1);
    const order = orderRows[0];
    if (!order) {
      return await secureJsonResponse({ status: 'error', message: 'order not found' }, { status: 404 });
    }

    if (PAID_STATUSES.includes(order.status) || order.paymentVerified) {
      return await secureJsonResponse({
        status: 'success',
        paid: true,
        orderStatus: order.status,
      });
    }

    const txRows = await db
      .select()
      .from(paymentTransactions)
      .where(and(
        eq(paymentTransactions.orderId, order.id),
        eq(paymentTransactions.method, 'credit_card'),
        isNotNull(paymentTransactions.gatewayChargeId),
      ))
      .orderBy(desc(paymentTransactions.createdAt))
      .limit(1);
    const tx = txRows[0];

    if (!tx || !tx.gatewayChargeId) {
      return await secureJsonResponse({ status: 'success', paid: false, message: 'No card intent found' });
    }

    const intentId = tx.gatewayChargeId;
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${intentId}`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
    });

    if (!res.ok) {
      return await secureJsonResponse({ status: 'success', paid: false, message: 'Intent lookup failed' });
    }

    const intent = await res.json();
    if (intent.status === 'succeeded') {
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
        })
        .where(eq(paymentTransactions.id, tx.id));

      const existingSlip = ((order as any).slip || {}) as Record<string, any>;
      const newSlip = mergeStripeReceiptSlipData(
        {
          ...existingSlip,
          method: 'credit_card',
          gateway: 'stripe',
          paymentIntentId: intent.id,
          latestChargeId: intent.latest_charge || null,
          cardLast4: intent.charges?.data?.[0]?.payment_method_details?.card?.last4 || '',
          cardBrand: intent.charges?.data?.[0]?.payment_method_details?.card?.brand || '',
        },
        receiptUrl
      );

      await db
        .update(orders)
        .set({
          status: 'PAID',
          paymentVerified: true,
          paymentVerifiedAt: new Date().toISOString(),
          slipData: newSlip as any,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      if (order.customerEmail) {
        sendPaymentReceivedEmail(order).catch((e) => console.error('[Stripe Card] Failed to send email:', e));
      }

      return await secureJsonResponse({ status: 'success', paid: true, orderStatus: 'PAID' });
    }

    return await secureJsonResponse({
      status: 'success',
      paid: false,
      intentStatus: intent.status,
    });
  } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[Stripe Card GET] Error:', err);
    return await secureJsonResponse(
      { status: 'error', message: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
