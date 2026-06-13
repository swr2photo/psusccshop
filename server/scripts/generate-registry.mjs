// Generates server/src/routes/registry.ts + route-modules.ts from src/app/api route files
// Run: node server/scripts/generate-registry.mjs
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../../src/app/api');
const routesDir = path.resolve(__dirname, '../src/routes');

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

const registryContent = `/** AUTO-GENERATED — run: node server/scripts/generate-registry.mjs */
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

const importLines = routes.map(
  (r, i) => `import * as __route_${i} from '${r.module}';`,
);
const mapEntries = routes.map(
  (r, i) => `  '${r.module}': __route_${i} as RouteModule,`,
);

const modulesContent = `/** AUTO-GENERATED — static imports for Cloudflare Workers bundling */
import type { NextRequest } from 'next/server';

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response> | Response;

type RouteModule = Partial<
  Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS', RouteHandler>
>;

${importLines.join('\n')}

export const ROUTE_MODULES: Record<string, RouteModule> = {
${mapEntries.join('\n')}
};
`;

await writeFile(path.join(routesDir, 'registry.ts'), registryContent, 'utf8');
await writeFile(path.join(routesDir, 'route-modules.ts'), modulesContent, 'utf8');
console.log(`Wrote ${routes.length} routes to ${routesDir}/registry.ts + route-modules.ts`);
