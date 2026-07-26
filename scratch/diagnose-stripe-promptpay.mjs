/**
 * Diagnose Stripe PromptPay capability (no secrets printed).
 */
import fs from 'fs';

const envPath = 'scratch/.env.stripe.local';
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    }),
);

const secret = env.STRIPE_SECRET_KEY || '';
const pub = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

console.log('secret_prefix', secret.slice(0, 7));
console.log('pub_prefix', pub.slice(0, 7));
console.log('livemode_secret', secret.startsWith('sk_live'));
console.log('livemode_pub', pub.startsWith('pk_live'));

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function stripePost(path, params) {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await res.json();
  return { status: res.status, json };
}

const account = await stripeGet('/account');
console.log('account', {
  id: account.json.id,
  country: account.json.country,
  default_currency: account.json.default_currency,
  charges_enabled: account.json.charges_enabled,
  payouts_enabled: account.json.payouts_enabled,
  details_submitted: account.json.details_submitted,
  business_type: account.json.business_type,
});

const caps = account.json.capabilities || {};
const promptCaps = Object.fromEntries(
  Object.entries(caps).filter(([k]) => /prompt|card_payments|transfers/i.test(k)),
);
console.log('capabilities_filtered', promptCaps);

// Try create + confirm PromptPay like production
const create = await stripePost('/payment_intents', {
  amount: '1000',
  currency: 'thb',
  'payment_method_types[]': 'promptpay',
  description: 'SCC PromptPay diagnostic',
});
console.log('create_pi', {
  status: create.status,
  id: create.json.id,
  pi_status: create.json.status,
  error: create.json.error
    ? {
        type: create.json.error.type,
        code: create.json.error.code,
        decline_code: create.json.error.decline_code,
        message: create.json.error.message,
      }
    : null,
});

if (create.json.id && create.json.client_secret) {
  const confirm = await stripePost(`/payment_intents/${create.json.id}/confirm`, {
    'payment_method_data[type]': 'promptpay',
    'payment_method_data[billing_details][email]': 'diagnostic@example.com',
  });
  console.log('confirm_pi', {
    status: confirm.status,
    pi_status: confirm.json.status,
    next_action: confirm.json.next_action?.type || null,
    has_qr: Boolean(confirm.json.next_action?.promptpay_display_qr_code),
    error: confirm.json.error
      ? {
          type: confirm.json.error.type,
          code: confirm.json.error.code,
          decline_code: confirm.json.error.decline_code,
          message: confirm.json.error.message,
          doc_url: confirm.json.error.doc_url,
        }
      : null,
  });

  // cleanup
  await stripePost(`/payment_intents/${create.json.id}/cancel`, {});
}

// Check payment method configs if available
const pmc = await stripeGet('/payment_method_configurations?limit=5');
if (pmc.json.data) {
  for (const cfg of pmc.json.data) {
    const pp = cfg.promptpay || cfg.promptPay;
    console.log('pmc', {
      id: cfg.id,
      name: cfg.name,
      active: cfg.active,
      promptpay: pp
        ? { available: pp.available, display_preference: pp.display_preference }
        : null,
    });
  }
} else if (pmc.json.error) {
  console.log('pmc_error', pmc.json.error.message);
}
