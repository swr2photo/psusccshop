// src/app/api/payment/webhook/stripe/route.ts
// Stripe webhook handler

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyStripeWebhook } from '@/lib/payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    // Verify webhook signature if configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && !verifyStripeWebhook(payload, signature)) {
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

  // Update transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: 'paid',
      gateway_transaction_id: paymentIntent.latest_charge,
      card_last4: cardLast4,
      card_brand: cardBrand,
      updated_at: new Date().toISOString(),
      raw_response: paymentIntent,
    })
    .eq('gateway_charge_id', intentId);

  // Update order status
  await supabase
    .from('orders')
    .update({
      status: 'paid',
      payment_status: 'paid',
      payment_method: 'credit_card',
      payment_verified: true,
      payment_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('ref', orderId);

  console.log('[Webhook] PaymentIntent succeeded for order:', orderId);
}

async function handlePaymentIntentFailed(paymentIntent: any) {
  const intentId = paymentIntent.id;
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) return;

  const errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';

  // Update transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: 'failed',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
      raw_response: paymentIntent,
    })
    .eq('gateway_charge_id', intentId);

  // Update order
  await supabase
    .from('orders')
    .update({
      payment_status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('ref', orderId);

  console.log('[Webhook] PaymentIntent failed for order:', orderId, errorMessage);
}

async function handlePaymentIntentCanceled(paymentIntent: any) {
  const intentId = paymentIntent.id;
  const orderId = paymentIntent.metadata?.orderId;

  if (!orderId) return;

  // Update transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('gateway_charge_id', intentId);

  // Update order if still pending
  await supabase
    .from('orders')
    .update({
      payment_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('ref', orderId)
    .eq('payment_status', 'pending');

  console.log('[Webhook] PaymentIntent canceled for order:', orderId);
}

async function handleChargeRefunded(charge: any) {
  const paymentIntentId = charge.payment_intent;
  
  if (!paymentIntentId) return;

  // Get transaction by payment intent ID
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('order_id, amount')
    .eq('gateway_charge_id', paymentIntentId)
    .single();

  if (!transaction) return;

  const isFullRefund = charge.amount_refunded >= charge.amount;

  // Update transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('gateway_charge_id', paymentIntentId);

  // Update order
  await supabase
    .from('orders')
    .update({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('ref', transaction.order_id);

  console.log('[Webhook] Charge refunded for PaymentIntent:', paymentIntentId);
}
