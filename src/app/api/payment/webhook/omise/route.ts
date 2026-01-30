// src/app/api/payment/webhook/omise/route.ts
// Omise webhook handler

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyOmiseWebhook } from '@/lib/payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-omise-signature') || '';

    // Verify webhook signature if configured
    const webhookSecret = process.env.OMISE_WEBHOOK_SECRET;
    if (webhookSecret && !verifyOmiseWebhook(payload, signature)) {
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
  await supabase
    .from('payment_transactions')
    .update({
      status: 'paid',
      gateway_transaction_id: charge.transaction,
      card_last4: charge.card?.last_digits,
      card_brand: charge.card?.brand,
      updated_at: new Date().toISOString(),
      raw_response: charge,
    })
    .eq('gateway_charge_id', chargeId);

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

  console.log('[Webhook] Charge complete for order:', orderId);
}

async function handleChargeCreate(charge: any) {
  const chargeId = charge.id;
  const orderId = charge.metadata?.orderId;

  if (!orderId) return;

  // Update transaction status
  await supabase
    .from('payment_transactions')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('gateway_charge_id', chargeId);

  console.log('[Webhook] Charge created for order:', orderId);
}

async function handleChargeFail(charge: any) {
  const chargeId = charge.id;
  const orderId = charge.metadata?.orderId;

  if (!orderId) return;

  // Update transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: 'failed',
      error_message: charge.failure_message || charge.failure_code,
      updated_at: new Date().toISOString(),
      raw_response: charge,
    })
    .eq('gateway_charge_id', chargeId);

  // Update order
  await supabase
    .from('orders')
    .update({
      payment_status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('ref', orderId);

  console.log('[Webhook] Charge failed for order:', orderId, charge.failure_message);
}

async function handleChargeExpire(charge: any) {
  const chargeId = charge.id;
  const orderId = charge.metadata?.orderId;

  if (!orderId) return;

  // Update transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('gateway_charge_id', chargeId);

  // Update order if still pending
  await supabase
    .from('orders')
    .update({
      payment_status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('ref', orderId)
    .eq('payment_status', 'pending');

  console.log('[Webhook] Charge expired for order:', orderId);
}

async function handleRefundCreate(refund: any) {
  const chargeId = refund.charge;
  
  // Get transaction by charge ID
  const { data: transaction } = await supabase
    .from('payment_transactions')
    .select('order_id, amount')
    .eq('gateway_charge_id', chargeId)
    .single();

  if (!transaction) return;

  const isFullRefund = refund.amount >= transaction.amount * 100;

  // Update transaction
  await supabase
    .from('payment_transactions')
    .update({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('gateway_charge_id', chargeId);

  // Update order
  await supabase
    .from('orders')
    .update({
      status: isFullRefund ? 'refunded' : 'partially_refunded',
      payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('ref', transaction.order_id);

  console.log('[Webhook] Refund created for charge:', chargeId);
}
