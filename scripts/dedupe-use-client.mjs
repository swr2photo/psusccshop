#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?)$/.test(name) && !name.endsWith('.bak')) out.push(p);
  }
  return out;
}

for (const filePath of walk(root)) {
  let src = fs.readFileSync(filePath, 'utf8');
  if (!src.includes("'use client'") && !src.includes('"use client"')) continue;

  const lines = src.split(/\r?\n/);
  const directive = /^['"]use client['"];?\s*$/;
  const indices = lines.map((l, i) => (directive.test(l.trim()) ? i : -1)).filter((i) => i >= 0);
  if (indices.length <= 1) continue;

  // Keep only the first use client
  const keep = indices[0];
  const next = lines.filter((_, i) => !directive.test(lines[i].trim()) || i === keep);
  const fixed = next.join('\n');
  if (fixed !== src) {
    fs.writeFileSync(filePath, fixed);
    console.log('Deduped use client:', path.relative(root, filePath));
  }
}
