/**
 * Audit proxy decisions for all API routes (simulates API_PROXY_ALL=1 + Vercel).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('src/app/api');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === 'route.ts') out.push(p);
  }
  return out;
}

const SESSION_BOUND = [
  '/api/auth',
  '/api/admin',
  '/api/shops',
  '/api/profile',
  '/api/cart',
  '/api/orders',
  '/api/config',
  '/api/upload',
  '/api/push-subscription',
  '/api/invoice',
  '/api/support-chat',
  '/api/refund',
  '/api/payment-info',
  '/api/payment/create-charge',
  '/api/payment/verify',
  '/api/payment/stripe',
  '/api/payment/config',
  '/api/shipping',
  '/api/stock-alert',
  '/api/privacy',
  '/api/gas',
  '/api/pickup',
  '/api/reviews',
  '/api/inventory',
  '/api/live',
  '/api/chatbot',
  '/api/promo',
  '/api/slip',
  '/api/auto-email',
];

const ALLOWLIST = [
  '/api/health',
  '/api/time',
  '/api/image',
  '/api/cron',
  '/api/payment/webhook',
  '/api/shops/catalog',
];

function match(pathname, prefixes) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function toPathname(file) {
  let rel = path.relative(ROOT, path.dirname(file)).replace(/\\/g, '/');
  // strip dynamic segments for prefix check — use parent static path
  const parts = rel.split('/').filter(Boolean).map((s) => (s.startsWith('[') ? ':param' : s));
  // For matching prefixes we use the static prefix before first dynamic
  const staticParts = [];
  for (const s of rel.split('/').filter(Boolean)) {
    if (s.startsWith('[')) break;
    staticParts.push(s);
  }
  return '/api' + (staticParts.length ? '/' + staticParts.join('/') : '');
}

function decide(pathname, method = 'GET') {
  if (match(pathname, SESSION_BOUND)) return 'vercel(session)';
  if (match(pathname, ALLOWLIST)) return 'workers(allowlist)';
  // fail-closed under PROXY_ALL
  return 'vercel(fail-closed)';
}

const routes = walk(ROOT).map((f) => {
  const pathname = toPathname(f);
  const src = fs.readFileSync(f, 'utf8');
  const usesAuth = /requireAuth|requireAdmin|requireSuperAdmin|requireAdminWithPermission|getSession\(|getSessionFromRequest/.test(
    src,
  );
  const runtime = decide(pathname, 'POST');
  const risk = usesAuth && runtime.startsWith('workers') ? 'RISK' : 'ok';
  return { file: path.relative(process.cwd(), f).replace(/\\/g, '/'), pathname, usesAuth, runtime, risk };
});

const risks = routes.filter((r) => r.risk === 'RISK');
const workers = routes.filter((r) => r.runtime.startsWith('workers'));
const session = routes.filter((r) => r.runtime === 'vercel(session)');
const failClosed = routes.filter((r) => r.runtime === 'vercel(fail-closed)');

console.log('Total routes:', routes.length);
console.log('Session-bound (Vercel):', session.length);
console.log('Workers allowlist:', workers.length);
console.log('Fail-closed Vercel:', failClosed.length);
console.log('RISK (auth on Workers):', risks.length);
if (risks.length) {
  console.log(risks);
}
console.log('\nWorkers targets:');
for (const r of workers) console.log(' ', r.pathname, '←', r.file);
console.log('\nFail-closed (stays Vercel, not in session list):');
for (const r of failClosed) console.log(' ', r.pathname, usesAuthLabel(r));

function usesAuthLabel(r) {
  return r.usesAuth ? '(has auth — add to SESSION_BOUND?)' : '(public/misc)';
}
