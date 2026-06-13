#!/usr/bin/env node
/**
 * Rotate NEXTAUTH_SECRET on Vercel + Cloudflare Workers — invalidates all sessions.
 *
 * Usage: node scripts/rotate-nextauth-secret.mjs
 * Requires: vercel login/link, wrangler login (for Workers)
 */
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRoot = path.resolve(root, '..', 'psusccshop-api');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    input: opts.input,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return r;
}

function newSecret() {
  return createHash('sha256').update(randomBytes(48)).digest('base64url');
}

function patchLocalEnv(secret) {
  for (const file of ['.env', '.env.local']) {
    const p = path.join(root, file);
    if (!existsSync(p)) continue;
    let text = readFileSync(p, 'utf8');
    if (/^NEXTAUTH_SECRET=.*$/m.test(text)) {
      text = text.replace(/^NEXTAUTH_SECRET=.*$/m, `NEXTAUTH_SECRET=${secret}`);
    } else {
      text += `\nNEXTAUTH_SECRET=${secret}\n`;
    }
    writeFileSync(p, text);
    console.log(`  Updated ${file}`);
  }
}

function vercelWhoami() {
  return run('npx', ['vercel', 'whoami']).status === 0;
}

function setVercelSecret(secret, target) {
  console.log(`  Vercel ${target}…`);
  const r = run('npx', ['vercel', 'env', 'add', 'NEXTAUTH_SECRET', target, '--value', secret, '--yes', '--force']);
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return false;
  }
  return true;
}

function setWorkersSecret(secret) {
  if (!existsSync(apiRoot)) {
    console.warn('  psusccshop-api not found — skip Workers (run wrangler secret put manually)');
    return true;
  }
  console.log('  Cloudflare Workers…');
  const r = run('npx', ['wrangler', 'secret', 'put', 'NEXTAUTH_SECRET'], {
    cwd: apiRoot,
    input: secret,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return false;
  }
  return true;
}

function redeployVercel() {
  console.log('  Triggering Vercel production redeploy…');
  const r = run('npx', ['vercel', 'deploy', '--prod', '--yes']);
  if (r.status !== 0) {
    console.warn(r.stderr || r.stdout);
    console.warn('  Redeploy manually: npx vercel deploy --prod');
    return false;
  }
  return true;
}

const secret = newSecret();
console.log('Rotating NEXTAUTH_SECRET (all users must log in again)\n');
console.log(`New secret length: ${secret.length} chars\n`);

patchLocalEnv(secret);

let ok = true;
if (!vercelWhoami()) {
  console.error('Not logged in to Vercel. Run: npx vercel login && npx vercel link');
  ok = false;
} else {
  ok = setVercelSecret(secret, 'production') && setVercelSecret(secret, 'preview') && ok;
  if (ok) redeployVercel();
}

ok = setWorkersSecret(secret) && ok;

if (ok) {
  console.log('\nDone. All JWT sessions are invalid — users must sign in again.');
  console.log('Workers picked up the new secret immediately (no redeploy needed).');
} else {
  console.error('\nSome steps failed — check output above.');
  process.exit(1);
}
