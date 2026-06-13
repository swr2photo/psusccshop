#!/usr/bin/env node
/**
 * Replace fetch('/api/...') with apiFetch(...) and add import where missing.
 * Skips .bak files. Auth routes are safe — apiFetch keeps /api/auth/* same-origin.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

const FETCH_API =
  /(\bawait\s+)?fetch\s*\(\s*(['"`]\/api\/|['"`]\$\{|`\/api\/|'\/api\/|"\/api\/)/g;

const IMPORT_LINE = "import { apiFetch } from '@/lib/api-client';";

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?)$/.test(name) && !name.endsWith('.bak')) out.push(p);
  }
  return out;
}

function migrateFile(filePath) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (!FETCH_API.test(src)) return false;
  FETCH_API.lastIndex = 0;

  let next = src.replace(/\bawait\s+fetch\s*\(/g, 'await apiFetch(');
  next = next.replace(/\bfetch\s*\(\s*(['"`]\/api\/)/g, 'apiFetch($1');
  next = next.replace(/\bfetch\s*\(\s*(`\/api\/)/g, 'apiFetch($1');
  next = next.replace(/\bfetch\s*\(\s*('\/api\/)/g, "apiFetch($1");
  next = next.replace(/\bfetch\s*\(\s*("\/api\/)/g, 'apiFetch($1');
  next = next.replace(/\bfetch\s*\(\s*('\/api\/[^']*'\s*\+)/g, 'apiFetch($1');
  next = next.replace(/\bfetch\s*\(\s*("\/api\/[^"]*"\s*\+)/g, 'apiFetch($1');
  next = next.replace(/\bfetch\s*\(\s*(`\/api\/[^`]*`\s*\+)/g, 'apiFetch($1');

  if (next === src) return false;

  if (!next.includes("from '@/lib/api-client'") && !next.includes('from "@/lib/api-client"')) {
    const useClient = next.startsWith("'use client'") || next.startsWith('"use client"');
    if (useClient) {
      next = next.replace(/^(['"]use client['"];?\s*\n)/, `$1${IMPORT_LINE}\n`);
    } else {
      next = `${IMPORT_LINE}\n${next}`;
    }
  }

  fs.writeFileSync(filePath, next);
  return true;
}

const files = walk(root);
let count = 0;
for (const f of files) {
  if (migrateFile(f)) {
    count++;
    console.log('Updated', path.relative(root, f));
  }
}
console.log(`Done — ${count} file(s) updated.`);
