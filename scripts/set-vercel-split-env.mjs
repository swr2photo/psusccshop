#!/usr/bin/env node
/**
 * Set Vercel production env for split deploy (frontend → api.psuscc.club).
 * Requires: npx vercel login && npx vercel link (in monorepo root)
 *
 * Usage: node scripts/set-vercel-split-env.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const VARS = {
  NEXT_PUBLIC_API_URL: 'https://api.psuscc.club',
  COOKIE_DOMAIN: '.psuscc.club',
  NEXTAUTH_URL: 'https://sccshop.psuscc.club',
};

const TARGETS = [
  { name: 'production' },
  { name: 'preview', gitBranch: 'main' },
];

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    input,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return r;
}

function whoami() {
  const r = run('npx', ['vercel', 'whoami']);
  return r.status === 0;
}

function addEnv(key, value, target, gitBranch) {
  console.log(`  ${key} → ${target}${gitBranch ? ` (${gitBranch})` : ''}`);
  const args = ['vercel', 'env', 'add', key, target];
  if (gitBranch) args.push(gitBranch);
  args.push('--value', value, '--yes', '--force');
  const r = run('npx', args);
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    return false;
  }
  return true;
}

function removeEnv(key, target) {
  run('npx', ['vercel', 'env', 'rm', key, target, '--yes']);
}

console.log('Vercel split-deploy env setup\n');

if (!whoami()) {
  console.log('Not logged in. Run:');
  console.log('  cd', root);
  console.log('  npx vercel login');
  console.log('  npx vercel link');
  console.log('  node scripts/set-vercel-split-env.mjs');
  console.log('\nOr set manually in Vercel Dashboard → Project → Settings → Environment Variables:');
  for (const [k, v] of Object.entries(VARS)) console.log(`  ${k}=${v}`);
  console.log('  (Remove API_INTERNAL_URL if present)');
  process.exit(1);
}

let ok = true;
for (const target of TARGETS) {
  console.log(`\n[${target.name}]`);
  removeEnv('API_INTERNAL_URL', target.name);
  for (const [key, value] of Object.entries(VARS)) {
    if (!addEnv(key, value, target.name, target.gitBranch)) ok = false;
  }
}

if (ok) {
  console.log('\nDone. Redeploy frontend: npx vercel --prod');
} else {
  process.exit(1);
}
