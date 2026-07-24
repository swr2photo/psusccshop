// Server-only payment helpers (DB access). Do not import from client components.

import { getConfigValueCached } from '@/lib/config-db';
import {
  isStripePromptPayEnabled,
  type PaymentConfig,
} from '@/lib/payment';

const PAYMENT_CONFIG_KEY = 'payment_config';

/** Load payment_config and evaluate Stripe PromptPay availability. */
export async function getStripePromptPayEnabled(amountTHB?: number): Promise<boolean> {
  const paymentConfig = await getConfigValueCached<PaymentConfig>(PAYMENT_CONFIG_KEY);
  return isStripePromptPayEnabled(paymentConfig, amountTHB);
}
