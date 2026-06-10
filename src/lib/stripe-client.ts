// src/lib/stripe-client.ts
// Stripe.js loader — per https://docs.stripe.com/js the script must always be
// loaded directly from https://js.stripe.com (never bundled or self-hosted).

'use client';

// ==================== MINIMAL STRIPE.JS TYPES ====================
// Only the surface we use for the custom PromptPay flow.

export interface StripePromptPayQrCode {
  /** Raw EMV payload — render with any QR library */
  data: string;
  /** Hosted PNG of the QR code (usable as <img src>) */
  image_url_png: string;
  /** Hosted SVG of the QR code */
  image_url_svg: string;
  hosted_instructions_url?: string;
  /** Unix timestamp (seconds) when the QR code expires */
  expires_at?: number;
}

export interface StripePaymentIntentResult {
  id: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'succeeded'
    | 'canceled';
  next_action?: {
    type?: string;
    promptpay_display_qr_code?: StripePromptPayQrCode;
  } | null;
  last_payment_error?: { message?: string } | null;
}

export interface StripeJS {
  confirmPromptPayPayment(
    clientSecret: string,
    data?: {
      payment_method?: {
        billing_details?: { email?: string; name?: string };
      };
      return_url?: string;
    },
    options?: { handleActions?: boolean }
  ): Promise<{ paymentIntent?: StripePaymentIntentResult; error?: { message?: string } }>;
  retrievePaymentIntent(
    clientSecret: string
  ): Promise<{ paymentIntent?: StripePaymentIntentResult; error?: { message?: string } }>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string, options?: { locale?: string }) => StripeJS;
  }
}

// ==================== LOADER ====================

const STRIPE_JS_URL = 'https://js.stripe.com/v3';

let scriptPromise: Promise<void> | null = null;
const instances = new Map<string, StripeJS>();

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Stripe.js can only be loaded in the browser'));
  }
  if (window.Stripe) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${STRIPE_JS_URL}"]`);
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = STRIPE_JS_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => {
      if (window.Stripe) resolve();
      else reject(new Error('Stripe.js loaded but window.Stripe is missing'));
    });
    script.addEventListener('error', () => {
      scriptPromise = null;
      reject(new Error('Failed to load Stripe.js'));
    });
  });
  return scriptPromise;
}

/**
 * Start downloading Stripe.js early (e.g. while the PaymentIntent is being
 * created) so getStripe() resolves instantly later.
 */
export function preloadStripeJs(): void {
  loadScript().catch(() => { /* surfaced later by getStripe */ });
}

/**
 * Load Stripe.js and return a shared Stripe instance for the publishable key.
 * (Stripe recommends creating a single instance per key.)
 */
export async function getStripe(publishableKey: string, locale = 'th'): Promise<StripeJS> {
  await loadScript();
  const cached = instances.get(publishableKey);
  if (cached) return cached;
  const stripe = window.Stripe!(publishableKey, { locale });
  instances.set(publishableKey, stripe);
  return stripe;
}
