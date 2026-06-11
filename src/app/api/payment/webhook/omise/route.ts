// src/app/api/payment/webhook/omise/route.ts
// Omise webhook handler

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, paymentTransactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyOmiseWebhook } from '@/lib/payment';
import { webhookSecretMissingResponse } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const missingSecret = webhookSecretMissingResponse('OMISE_WEBHOOK_SECRET');
    if (missingSecret) return missingSecret;

    const payload = await request.text();
    const signature = request.headers.get('x-omise-signature') || '';

    const webhookSecret = process.env.OMISE_WEBHOOK_SECRET;
    if (!webhookSecret || !verifyOmiseWebhook(payload, signature)) {
      console.error('[Webhook] Invalid Omise signature');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const event = JSON.parse(payload);
    console.log('[Webhook] Omise event:', event.key);

    // Handle different event types
    switch (event.key) {
      case 'charge.complete':
        await handleChargeComplete(event.data);
        break;

      case 'charge.create':
        await handleChargeCreate(event.data);
        break;

      case 'charge.fail':
        await handleChargeFail(event.data);
        break;

      case 'charge.expire':
        await handleChargeExpire(event.data);
        break;

      case 'refund.create':
        await handleRefundCreate(event.data);
        break;

      default:
        console.log('[Webhook] Unhandled Omise event:', event.key);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Webhook] Omise error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleChargeComplete(charge: any) {
  const chargeId = charge.id;
  const orderId = charge.metadata?.orderId;

  if (!orderId) {
    console.error('[Webhook] Missing orderId in charge metadata');
    return;
  }

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: 'paid',
      gatewayTransactionId: charge.transaction,
      cardLast4: charge.card?.last_digits,
      cardBrand: charge.card?.brand,
      updatedAt: new Date(),
      rawResponse: charge,
    })
    .where(eq(paymentTransactions.gatewayChargeId, chargeId));

  // Update order status
  await db
    .update(orders)
    .set({
      status: 'PAID',
      paymentStatus: 'paid',
      paymentMethod: 'credit_card',
      paymentVerified: true,
      paymentVerifiedAt: new Date().toISOString(),
      updatedAt: new Date(),
    })
    .where(eq(orders.ref, orderId));

  console.log('[Webhook] Charge complete for order:', orderId);
}

async function handleChargeCreate(charge: any) {
  const chargeId = charge.id;
  const orderId = charge.metadata?.orderId;

  if (!orderId) return;

  // Update transaction status
  await db
    .update(paymentTransactions)
    .set({
      status: 'processing',
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.gatewayChargeId, chargeId));

  console.log('[Webhook] Charge created for order:', orderId);
}

async function handleChargeFail(charge: any) {
  const chargeId = charge.id;
  const orderId = charge.metadata?.orderId;

  if (!orderId) return;

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: 'failed',
      errorMessage: charge.failure_message || charge.failure_code,
      updatedAt: new Date(),
      rawResponse: charge,
    })
    .where(eq(paymentTransactions.gatewayChargeId, chargeId));

  // Update order
  await db
    .update(orders)
    .set({
      paymentStatus: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(orders.ref, orderId));

  console.log('[Webhook] Charge failed for order:', orderId, charge.failure_message);
}

async function handleChargeExpire(charge: any) {
  const chargeId = charge.id;
  const orderId = charge.metadata?.orderId;

  if (!orderId) return;

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: 'expired',
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.gatewayChargeId, chargeId));

  // Update order if still pending
  await db
    .update(orders)
    .set({
      paymentStatus: 'expired',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.ref, orderId),
        eq(orders.paymentStatus, 'pending')
      )
    );

  console.log('[Webhook] Charge expired for order:', orderId);
}

async function handleRefundCreate(refund: any) {
  const chargeId = refund.charge;
  
  // Get transaction by charge ID
  const transactionData = await db
    .select({ orderId: paymentTransactions.orderId, amount: paymentTransactions.amount })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.gatewayChargeId, chargeId))
    .limit(1);
  const transaction = transactionData[0];

  if (!transaction) return;

  const isFullRefund = refund.amount >= transaction.amount * 100;

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.gatewayChargeId, chargeId));

  // Update order
  await db
    .update(orders)
    .set({
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, transaction.orderId));

  console.log('[Webhook] Refund created for charge:', chargeId);
}
