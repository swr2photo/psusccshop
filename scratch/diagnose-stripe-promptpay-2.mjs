/**
 * Deeper Stripe PromptPay failure diagnosis (no secrets printed).
 */
import fs from 'fs';

// Re-pull quickly inside script? Expect file from prior pull — re-pull if missing.
import { execSync } from 'child_process';
if (!fs.existsSync('scratch/.env.stripe.local')) {
  execSync('npx vercel env pull scratch/.env.stripe.local --environment production --yes', {
    stdio: 'inherit',
  });
}

const env = Object.fromEntries(
  fs
    .readFileSync('scratch/.env.stripe.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    }),
);

const secret = env.STRIPE_SECRET_KEY;

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  return { status: res.status, json: await res.json() };
}

async function stripePost(path, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => body.append(k, x));
    else body.append(k, String(v));
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  return { status: res.status, json: await res.json() };
}

const account = await stripeGet('/account');
const a = account.json;
console.log('requirements', {
  currently_due: a.requirements?.currently_due || [],
  past_due: a.requirements?.past_due || [],
  pending_verification: a.requirements?.pending_verification || [],
  disabled_reason: a.requirements?.disabled_reason || null,
  errors: (a.requirements?.errors || []).map((e) => ({
    code: e.code,
    reason: e.reason,
    requirement: e.requirement,
  })),
});
console.log('future_requirements', {
  currently_due: a.future_requirements?.currently_due || [],
  pending_verification: a.future_requirements?.pending_verification || [],
});

// Try create+confirm in one request (like earlier production flow)
const oneShot = await stripePost('/payment_intents', {
  amount: '2000',
  currency: 'thb',
  'payment_method_types[]': 'promptpay',
  confirm: 'true',
  'payment_method_data[type]': 'promptpay',
  'payment_method_data[billing_details][email]': 'diagnostic@psuscc.club',
  return_url: 'https://sccshop.psuscc.club/',
  description: 'SCC one-shot PromptPay diagnostic',
});
console.log('one_shot_confirm', {
  http: oneShot.status,
  id: oneShot.json.id,
  status: oneShot.json.status,
  next_action: oneShot.json.next_action?.type || null,
  has_qr: Boolean(oneShot.json.next_action?.promptpay_display_qr_code),
  error: oneShot.json.error
    ? {
        type: oneShot.json.error.type,
        code: oneShot.json.error.code,
        decline_code: oneShot.json.error.decline_code,
        message: oneShot.json.error.message,
        payment_intent_status: oneShot.json.error.payment_intent?.status,
        request_log_url: oneShot.json.error.request_log_url,
      }
    : null,
});

if (oneShot.json.id) {
  await stripePost(`/payment_intents/${oneShot.json.id}/cancel`, {}).catch(() => {});
} else if (oneShot.json.error?.payment_intent?.id) {
  await stripePost(`/payment_intents/${oneShot.json.error.payment_intent.id}/cancel`, {}).catch(
    () => {},
  );
}

// Separate create then confirm with return_url
const create = await stripePost('/payment_intents', {
  amount: '2000',
  currency: 'thb',
  'payment_method_types[]': 'promptpay',
  description: 'SCC two-step PromptPay diagnostic',
});
const confirm = await stripePost(`/payment_intents/${create.json.id}/confirm`, {
  'payment_method_data[type]': 'promptpay',
  'payment_method_data[billing_details][email]': 'diagnostic@psuscc.club',
  return_url: 'https://sccshop.psuscc.club/',
});
console.log('two_step_confirm', {
  http: confirm.status,
  status: confirm.json.status,
  next_action: confirm.json.next_action?.type || null,
  has_qr: Boolean(confirm.json.next_action?.promptpay_display_qr_code),
  error: confirm.json.error
    ? {
        code: confirm.json.error.code,
        decline_code: confirm.json.error.decline_code,
        message: confirm.json.error.message,
        request_log_url: confirm.json.error.request_log_url,
      }
    : null,
});
if (create.json.id) {
  await stripePost(`/payment_intents/${create.json.id}/cancel`, {}).catch(() => {});
}

// Capability detail
const cap = await stripeGet('/accounts/' + a.id + '/capabilities/promptpay_payments');
console.log('promptpay_capability_detail', {
  http: cap.status,
  id: cap.json.id,
  status: cap.json.status,
  requirements: cap.json.requirements,
});

fs.unlinkSync('scratch/.env.stripe.local');
console.log('cleaned');
