// Generates server/src/routes/registry.ts from src/app/api route files
// Run: node server/scripts/generate-registry.mjs
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../../src/app/api');
const outFile = path.resolve(__dirname, '../src/routes/registry.ts');

const AUTH_PREFIXES = [
  'auth/[...nextauth]',
  'auth/passkey/login',
  'auth/passkey',
  'auth/available-providers',
];

async function walk(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    const rel = base ? `${base}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      files.push(...(await walk(path.join(dir, ent.name), rel)));
    } else if (ent.name === 'route.ts') {
      files.push(rel.replace(/\/route\.ts$/, ''));
    }
  }
  return files;
}

function toPattern(segments) {
  return (
    '/' +
    segments
      .split('/')
      .map((seg) => {
        if (seg.startsWith('[') && seg.endsWith(']')) {
          const inner = seg.slice(1, -1);
          if (inner.startsWith('...')) return `*${inner.slice(3)}`;
          return `:${inner}`;
        }
        return seg;
      })
      .join('/')
  );
}

function specificity(pattern) {
  const parts = pattern.split('/').filter(Boolean);
  let score = parts.length * 100;
  for (const p of parts) {
    if (!p.startsWith(':') && !p.startsWith('*')) score += 10;
  }
  return score;
}

const all = await walk(apiRoot);
const routes = all
  .filter((rel) => !AUTH_PREFIXES.some((a) => rel === a || rel.startsWith(a + '/')))
  .map((rel) => ({
    pattern: toPattern(rel),
    module: `@/app/api/${rel}/route`,
    specificity: specificity(toPattern(rel)),
  }))
  .sort((a, b) => b.specificity - a.specificity);

const content = `/** AUTO-GENERATED — run: node server/scripts/generate-registry.mjs */
export type RouteEntry = {
  pattern: string;
  module: string;
};

export const API_ROUTES: RouteEntry[] = ${JSON.stringify(
  routes.map(({ pattern, module }) => ({ pattern, module })),
  null,
  2,
)};
`;

await writeFile(outFile, content, 'utf8');
console.log(`Wrote ${routes.length} routes to ${outFile}`);
