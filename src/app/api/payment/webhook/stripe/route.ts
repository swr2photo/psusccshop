// src/app/api/payment/webhook/stripe/route.ts
// Stripe webhook handler

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, paymentTransactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyStripeWebhook } from '@/lib/payment';
import { fetchStripeReceiptUrl, mergeStripeReceiptSlipData } from '@/lib/stripe-receipt';
import { webhookSecretMissingResponse } from '@/lib/api-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const missingSecret = webhookSecretMissingResponse('STRIPE_WEBHOOK_SECRET');
    if (missingSecret) return missingSecret;

    const payload = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret || !verifyStripeWebhook(payload, signature)) {
      console.error('[Webhook] Invalid Stripe signature');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 400 }
      );
    }

    const event = JSON.parse(payload);
    console.log('[Webhook] Stripe event:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;

      default:
        console.log('[Webhook] Unhandled Stripe event:', event.type);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Webhook] Stripe error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const intentId = paymentIntent.id;
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) {
    console.error('[Webhook] Missing orderId in PaymentIntent metadata');
    return;
  }

  // Get card details from payment method
  const paymentMethodId = paymentIntent.payment_method;
  let cardLast4 = '';
  let cardBrand = '';

  if (paymentIntent.charges?.data?.[0]?.payment_method_details?.card) {
    const card = paymentIntent.charges.data[0].payment_method_details.card;
    cardLast4 = card.last4;
    cardBrand = card.brand;
  }

  const receiptUrl = await fetchStripeReceiptUrl(intentId);

  const orderRows = await db
    .select({ id: orders.id, slipData: orders.slipData })
    .from(orders)
    .where(eq(orders.ref, orderId))
    .limit(1);
  const slipData = mergeStripeReceiptSlipData(orderRows[0]?.slipData, receiptUrl);

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: 'paid',
      gatewayTransactionId: paymentIntent.latest_charge,
      cardLast4: cardLast4,
      cardBrand: cardBrand,
      verified: true,
      verificationMethod: 'gateway',
      verifiedAt: new Date(),
      updatedAt: new Date(),
      rawResponse: paymentIntent,
    })
    .where(eq(paymentTransactions.gatewayChargeId, intentId));

  // Determine actual payment method (promptpay, card, ...)
  const methodType: string = paymentIntent.payment_method_types?.includes('promptpay')
    ? 'promptpay'
    : 'credit_card';

  // Update order status
  await db
    .update(orders)
    .set({
      status: 'PAID',
      paymentStatus: 'paid',
      paymentMethod: methodType,
      paymentGateway: 'stripe',
      paymentVerified: true,
      paymentVerifiedAt: new Date().toISOString(),
      updatedAt: new Date(),
      ...(slipData ? { slipData } : {}),
    })
    .where(eq(orders.ref, orderId));

  console.log('[Webhook] PaymentIntent succeeded for order:', orderId);
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  const intentId = paymentIntent.id;
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) return;

  const errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: 'failed',
      errorMessage: errorMessage,
      updatedAt: new Date(),
      rawResponse: paymentIntent,
    })
    .where(eq(paymentTransactions.gatewayChargeId, intentId));

  // Update order
  await db
    .update(orders)
    .set({
      paymentStatus: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(orders.ref, orderId));

  console.log('[Webhook] PaymentIntent failed for order:', orderId, errorMessage);
}

async function handlePaymentIntentCanceled(paymentIntent: any) {
  const intentId = paymentIntent.id;
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) return;

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.gatewayChargeId, intentId));

  // Update order if still pending
  await db
    .update(orders)
    .set({
      paymentStatus: 'cancelled',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.ref, orderId),
        eq(orders.paymentStatus, 'pending')
      )
    );

  console.log('[Webhook] PaymentIntent canceled for order:', orderId);
}

async function handleChargeRefunded(charge: any) {
  const paymentIntentId = charge.payment_intent;
  
  if (!paymentIntentId) return;

  // Get transaction by payment intent ID
  const transactionData = await db
    .select({ orderId: paymentTransactions.orderId, amount: paymentTransactions.amount })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.gatewayChargeId, paymentIntentId))
    .limit(1);
  const transaction = transactionData[0];

  if (!transaction) return;

  const isFullRefund = charge.amount_refunded >= charge.amount;

  // Update transaction
  await db
    .update(paymentTransactions)
    .set({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      updatedAt: new Date(),
    })
    .where(eq(paymentTransactions.gatewayChargeId, paymentIntentId));

  // Update order
  await db
    .update(orders)
    .set({
      status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      paymentStatus: isFullRefund ? 'refunded' : 'partially_refunded',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, transaction.orderId));

  console.log('[Webhook] Charge refunded for PaymentIntent:', paymentIntentId);
}
