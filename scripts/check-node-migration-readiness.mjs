#!/usr/bin/env node
/**
 * Scan the repo for Node.js major-upgrade hazards (24 → 26 prep).
 *
 * Usage:
 *   node scripts/check-node-migration-readiness.mjs
 *   npm run check:node-ready
 *
 * Local Node 26 smoke (when ready):
 *   nvm install 26 && nvm use 26
 *   npm ci
 *   NODE_OPTIONS=--trace-warnings npm run build
 *
 * Production note: Vercel currently supports 20.x / 22.x / 24.x only.
 * Do NOT set engines.node to 26.x on main until Vercel lists 26.x.
 *
 * Native package to re-verify before cutover: @sentry/profiling-node
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'ios',
  'android',
  'scratch',
]);

const PATTERNS = [
  {
    id: 'writeHeader',
    re: /\.writeHeader\s*\(/,
    severity: 'error',
    tip: 'Replace res.writeHeader() with res.writeHead() (removed in Node 26)',
  },
  {
    id: 'private-stream',
    re: /['"]stream\/_stream_/,
    severity: 'error',
    tip: 'Import from node:stream instead of stream/_stream_*',
  },
  {
    id: 'experimental-strip-types',
    re: /--experimental-strip-types|experimentalStripTypes/,
    severity: 'warn',
    tip: 'Type stripping is stable on Node 26 — drop experimental flags',
  },
];

const NATIVE_ISH = [
  '@sentry/profiling-node',
  'sharp',
  'bcrypt',
  'bcryptjs',
  'argon2',
  'canvas',
  'better-sqlite3',
  'sqlite3',
  'node-gyp',
];

const TEXT_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.toml',
  '.md',
  '.Dockerfile',
]);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function shouldScan(file) {
  const base = path.basename(file);
  if (base === 'Dockerfile' || base.startsWith('Dockerfile.')) return true;
  const ext = path.extname(file);
  return TEXT_EXTS.has(ext);
}

function readJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readText(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8').trim();
}

const findings = [];
const files = walk(root).filter(shouldScan);

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const rel = path.relative(root, file).replace(/\\/g, '/');
  // Skip this script's own pattern strings
  if (rel === 'scripts/check-node-migration-readiness.mjs') continue;

  for (const pat of PATTERNS) {
    if (!pat.re.test(text)) continue;
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      if (pat.re.test(line)) {
        findings.push({
          severity: pat.severity,
          id: pat.id,
          file: rel,
          line: i + 1,
          tip: pat.tip,
          snippet: line.trim().slice(0, 120),
        });
      }
    });
  }
}

const pkg = readJson('package.json') || {};
const enginesNode = pkg.engines?.node || '(missing)';
const nvmrc = readText('.nvmrc') || '(missing)';
const nodeVersion = readText('.node-version') || '(missing)';
const dockerfile = readText('Dockerfile') || '';
const dockerfileCron = readText('Dockerfile.cron') || '';
const nixpacks = readText('nixpacks.toml') || '';

const deps = {
  ...(pkg.dependencies || {}),
  ...(pkg.devDependencies || {}),
};
const nativePresent = NATIVE_ISH.filter((name) => deps[name]);

console.log('=== Node migration readiness ===\n');
console.log(`engines.node:     ${enginesNode}`);
console.log(`.nvmrc:           ${nvmrc}`);
console.log(`.node-version:    ${nodeVersion}`);
console.log(
  `Dockerfile:       ${/node:\d+/.exec(dockerfile)?.[0] || '(no node image)'}`,
);
console.log(
  `Dockerfile.cron:  ${/node:\d+/.exec(dockerfileCron)?.[0] || '(no node image)'}`,
);
console.log(
  `nixpacks:         ${/nodejs_\d+/.exec(nixpacks)?.[0] || '(missing)'}`,
);
console.log(
  `native-ish deps:  ${nativePresent.length ? nativePresent.join(', ') : '(none)'}`,
);
console.log('');

if (enginesNode.includes('26')) {
  findings.push({
    severity: 'warn',
    id: 'engines-26-prod',
    file: 'package.json',
    line: 0,
    tip: 'Vercel Production may not support Node 26 yet — keep 24.x on main until docs list 26.x',
    snippet: `engines.node=${enginesNode}`,
  });
}

const drift = [];
if (!String(nvmrc).startsWith('24') && !String(enginesNode).includes('26')) {
  drift.push(`.nvmrc=${nvmrc} vs engines=${enginesNode}`);
}
if (!dockerfile.includes('node:24') && !dockerfile.includes('node:26')) {
  drift.push('Dockerfile not on node:24/26');
}
if (!dockerfileCron.includes('node:24') && !dockerfileCron.includes('node:26')) {
  drift.push('Dockerfile.cron not on node:24/26');
}
if (!nixpacks.includes('nodejs_24') && !nixpacks.includes('nodejs_26')) {
  drift.push('nixpacks not on nodejs_24/26');
}

for (const d of drift) {
  findings.push({
    severity: 'warn',
    id: 'version-drift',
    file: '(infra)',
    line: 0,
    tip: 'Align local/Docker/Railway pins with package.json engines',
    snippet: d,
  });
}

const errors = findings.filter((f) => f.severity === 'error');
const warns = findings.filter((f) => f.severity === 'warn');

if (findings.length === 0) {
  console.log('OK — no writeHeader / private stream / strip-types flags found.');
  console.log('Baseline pins look consistent for Node 24 production.');
  console.log('\nBefore Node 26 cutover: re-test @sentry/profiling-node on Node 26 locally.');
  process.exit(0);
}

for (const f of findings) {
  const loc = f.line ? `${f.file}:${f.line}` : f.file;
  console.log(`[${f.severity.toUpperCase()}] ${f.id} @ ${loc}`);
  console.log(`  ${f.tip}`);
  if (f.snippet) console.log(`  ${f.snippet}`);
  console.log('');
}

console.log(`Summary: ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length > 0 ? 1 : 0);
