/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-only payment helpers (gateway I/O + DB). Do not import from client components.
import 'server-only';

import { getConfigValueCached } from '@/lib/config-db';
import type {
  PaymentConfig,
  StripeSpecificConfig,
} from '@/lib/payment';

const PAYMENT_CONFIG_KEY = 'payment_config';

// ==================== OMISE INTEGRATION ====================

export interface OmiseChargeParams {
  amount: number;
  currency?: string;
  card?: string;
  customer?: string;
  description?: string;
  metadata?: Record<string, any>;
  returnUri?: string;
  source?: string;
}

export interface OmiseCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  authorizeUri?: string;
  failureCode?: string;
  failureMessage?: string;
  card?: {
    id: string;
    brand: string;
    last_digits: string;
    expiration_month: number;
    expiration_year: number;
  };
}

/**
 * Create Omise charge
 */
export async function createOmiseCharge(params: OmiseChargeParams): Promise<OmiseCharge | null> {
  const secretKey = process.env.OMISE_SECRET_KEY;

  if (!secretKey) {
    console.error('[Payment] Omise secret key not configured');
    return null;
  }

  try {
    const res = await fetch('https://api.omise.co/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency || 'THB',
        card: params.card,
        customer: params.customer,
        description: params.description,
        metadata: params.metadata,
        return_uri: params.returnUri,
        source: params.source,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Payment] Omise charge failed:', errorData);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('[Payment] Omise charge error:', error);
    return null;
  }
}

/**
 * Create Omise token (should be done client-side ideally)
 */
export async function createOmiseToken(
  cardNumber: string,
  name: string,
  expirationMonth: number,
  expirationYear: number,
  securityCode: string
): Promise<{ id: string } | null> {
  const publicKey = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY;

  if (!publicKey) {
    console.error('[Payment] Omise public key not configured');
    return null;
  }

  try {
    const res = await fetch('https://vault.omise.co/tokens', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(publicKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        card: {
          number: cardNumber,
          name: name,
          expiration_month: expirationMonth,
          expiration_year: expirationYear,
          security_code: securityCode,
        },
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Payment] Omise token failed:', errorData);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('[Payment] Omise token error:', error);
    return null;
  }
}

/**
 * Create Omise source for alternative payment methods
 */
export async function createOmiseSource(
  type: 'truemoney' | 'installment_bay' | 'installment_bbl' | 'installment_kbank' | 'installment_ktc' | 'installment_scb',
  amount: number,
  options?: {
    phoneNumber?: string;
    installmentTerm?: number;
  }
): Promise<{ id: string; amount: number; flow: string } | null> {
  const publicKey = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY;

  if (!publicKey) {
    console.error('[Payment] Omise public key not configured');
    return null;
  }

  try {
    const body: Record<string, any> = {
      type,
      amount,
      currency: 'THB',
    };

    if (type === 'truemoney' && options?.phoneNumber) {
      body.phone_number = options.phoneNumber;
    }

    if (type.startsWith('installment_') && options?.installmentTerm) {
      body.installment_term = options.installmentTerm;
    }

    const res = await fetch('https://api.omise.co/sources', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(publicKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error('[Payment] Omise source failed:', errorData);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('[Payment] Omise source error:', error);
    return null;
  }
}

/**
 * Verify Omise webhook signature
 */
export function verifyOmiseWebhook(
  payload: string,
  signature: string
): boolean {
  const webhookSecret = process.env.OMISE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Payment] Omise webhook secret not configured');
    return false;
  }

  // Omise uses the signature directly
  // eslint-disable-next-line @typescript-eslint/no-require-imports

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// ==================== STRIPE INTEGRATION ====================

export interface StripePaymentIntentParams {
  amount: number;
  currency?: string;
  paymentMethodTypes?: string[];
  description?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  /** Confirm server-side immediately (Direct API flow) */
  confirm?: boolean;
  /** Inline payment method data used with confirm=true */
  paymentMethodData?: {
    type: string;
    billingEmail?: string;
  };
}

export interface StripePaymentIntentResult {
  clientSecret: string;
  id: string;
  status: string;
  /** e.g. next_action.promptpay_display_qr_code when confirmed server-side */
  nextAction?: any;
}

export type StripePaymentIntentCreateResult =
  | { ok: true; intent: StripePaymentIntentResult }
  | {
      ok: false;
      message: string;
      code?: string;
      declineCode?: string;
    };

/**
 * Create Stripe PaymentIntent.
 * Prefer create-without-confirm for PromptPay, then confirm client-side
 * (server confirm often returns payment_method_not_available).
 */
export async function createStripePaymentIntent(
  params: StripePaymentIntentParams
): Promise<StripePaymentIntentResult | null> {
  const result = await createStripePaymentIntentDetailed(params);
  return result.ok ? result.intent : null;
}

export async function createStripePaymentIntentDetailed(
  params: StripePaymentIntentParams
): Promise<StripePaymentIntentCreateResult> {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    console.error('[Payment] Stripe secret key not configured');
    return { ok: false, message: 'Stripe is not configured', code: 'not_configured' };
  }

  try {
    const body = new URLSearchParams({
      amount: params.amount.toString(),
      currency: params.currency || 'thb',
    });

    for (const type of params.paymentMethodTypes?.length ? params.paymentMethodTypes : ['card']) {
      body.append('payment_method_types[]', type);
    }

    if (params.confirm) {
      body.append('confirm', 'true');
    }

    if (params.paymentMethodData) {
      body.append('payment_method_data[type]', params.paymentMethodData.type);
      if (params.paymentMethodData.billingEmail) {
        body.append('payment_method_data[billing_details][email]', params.paymentMethodData.billingEmail);
        body.append('receipt_email', params.paymentMethodData.billingEmail);
      }
    }

    if (params.returnUrl) {
      body.append('return_url', params.returnUrl);
    }

    if (params.description) {
      body.append('description', params.description);
    }

    if (params.metadata) {
      Object.entries(params.metadata).forEach(([key, value]) => {
        body.append(`metadata[${key}]`, String(value));
      });
    }

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      console.error('[Payment] Stripe PaymentIntent failed:', data);
      const err = data?.error || {};
      return {
        ok: false,
        message:
          err.message ||
          'สร้างรายการชำระเงินไม่สำเร็จ กรุณาลองใหม่ หรือเลือกโอนเอง + แนบสลิป',
        code: err.code,
        declineCode: err.decline_code,
      };
    }

    return {
      ok: true,
      intent: {
        clientSecret: data.client_secret,
        id: data.id,
        status: data.status,
        nextAction: data.next_action || null,
      },
    };
  } catch (error: unknown) {
    console.error('[Payment] Stripe PaymentIntent error:', error);
    return {
      ok: false,
      message: error?.message || 'Stripe request failed',
      code: 'network_error',
    };
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhook(
  payload: string,
  signature: string,
  toleranceSeconds = 300,
): boolean {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Payment] Stripe webhook secret not configured');
    return false;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports

    const crypto = require('crypto');
    const signatureParts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = signatureParts['t'];
    const sig = signatureParts['v1'];

    if (!timestamp || !sig) return false;

    const eventTime = Number(timestamp);
    if (!Number.isFinite(eventTime)) return false;
    const age = Math.abs(Math.floor(Date.now() / 1000) - eventTime);
    if (age > toleranceSeconds) {
      console.error('[Payment] Stripe webhook timestamp outside tolerance window');
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch (error) {
    console.error('[Payment] Stripe webhook verification error:', error);
    return false;
  }
}

// ==================== STRIPE PROMPTPAY AVAILABILITY ====================

const DEFAULT_STRIPE_PROMPTPAY: Pick<
  StripeSpecificConfig,
  'enablePromptPay' | 'promptPayMinAmount' | 'promptPayMaxAmount' | 'promptPayExpirationMinutes'
> = {
  enablePromptPay: true,
  promptPayMinAmount: 10,
  promptPayMaxAmount: 0,
  promptPayExpirationMinutes: 15,
};

export function isStripeEnvConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

/** Resolve Stripe-specific config from payment_config (defaults when unset). */
export function resolveStripeSpecificConfig(
  paymentConfig: PaymentConfig | null | undefined,
): StripeSpecificConfig {
  const stripeGw = paymentConfig?.gateways?.find((g) => g.gateway === 'stripe');
  return {
    enablePromptPay: DEFAULT_STRIPE_PROMPTPAY.enablePromptPay,
    enableCreditCard: false,
    promptPayMinAmount: DEFAULT_STRIPE_PROMPTPAY.promptPayMinAmount,
    promptPayMaxAmount: DEFAULT_STRIPE_PROMPTPAY.promptPayMaxAmount,
    enableAutoRefund: false,
    receiptEmailEnabled: true,
    currency: 'thb',
    promptPayExpirationMinutes: DEFAULT_STRIPE_PROMPTPAY.promptPayExpirationMinutes,
    ...(stripeGw?.stripeConfig || {}),
  };
}

/**
 * Whether Stripe PromptPay should be offered to customers.
 * Respects admin toggle (stripeConfig.enablePromptPay) and optional amount limits.
 * Defaults to enabled when Stripe env keys exist and no toggle has been saved yet.
 */
export function isStripePromptPayEnabled(
  paymentConfig: PaymentConfig | null | undefined,
  amountTHB?: number,
): boolean {
  if (!isStripeEnvConfigured()) return false;

  const stripe = resolveStripeSpecificConfig(paymentConfig);
  if (!stripe.enablePromptPay) return false;

  if (typeof amountTHB === 'number' && Number.isFinite(amountTHB)) {
    const min = stripe.promptPayMinAmount ?? 10;
    const max = stripe.promptPayMaxAmount ?? 0;
    if (amountTHB < min) return false;
    if (max > 0 && amountTHB > max) return false;
  }

  return true;
}

/** Load payment_config and evaluate Stripe PromptPay availability. */
export async function getStripePromptPayEnabled(amountTHB?: number): Promise<boolean> {
  const paymentConfig = await getConfigValueCached<PaymentConfig>(PAYMENT_CONFIG_KEY);
  return isStripePromptPayEnabled(paymentConfig, amountTHB);
}
