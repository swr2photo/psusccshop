/**
 * Stripe receipt helpers — hosted receipt at pay.stripe.com
 */

export async function fetchStripeReceiptUrl(paymentIntentId: string): Promise<string | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || !paymentIntentId.startsWith('pi_')) return null;

  try {
    const res = await fetch(
      `https://api.stripe.com/v1/payment_intents/${paymentIntentId}?expand[]=latest_charge`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    if (!res.ok) return null;

    const intent = await res.json();
    const charge = intent.latest_charge;

    if (charge && typeof charge === 'object' && charge.receipt_url) {
      return charge.receipt_url as string;
    }

    const chargeId = typeof charge === 'string' ? charge : null;
    if (!chargeId) return null;

    const chargeRes = await fetch(`https://api.stripe.com/v1/charges/${chargeId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!chargeRes.ok) return null;

    const chargeData = await chargeRes.json();
    return (chargeData.receipt_url as string) || null;
  } catch (error) {
    console.error('[Stripe Receipt] lookup failed:', error);
    return null;
  }
}

export function readStoredStripeReceiptUrl(slipData: unknown): string | null {
  if (!slipData || typeof slipData !== 'object') return null;
  const url = (slipData as Record<string, unknown>).stripeReceiptUrl;
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

export function mergeStripeReceiptSlipData(
  slipData: unknown,
  receiptUrl: string | null
): Record<string, unknown> | null {
  if (!receiptUrl) {
    return slipData && typeof slipData === 'object'
      ? { ...(slipData as Record<string, unknown>) }
      : null;
  }
  return {
    ...(slipData && typeof slipData === 'object' ? (slipData as Record<string, unknown>) : {}),
    stripeReceiptUrl: receiptUrl,
  };
}
