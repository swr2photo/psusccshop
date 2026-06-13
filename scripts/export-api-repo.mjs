#!/usr/bin/env node
/**
 * Export standalone psusccshop-api repository (sibling folder by default).
 * Usage: node scripts/export-api-repo.mjs [outputDir]
 */
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, '..', 'psusccshop-api'));

const FRONTEND_ONLY_DEPS = new Set([
  '@emotion/react',
  '@emotion/server',
  '@emotion/styled',
  '@mui/icons-material',
  '@mui/material',
  '@mui/material-nextjs',
  '@simplewebauthn/browser',
  '@tanstack/react-query',
  '@tanstack/react-query-devtools',
  '@types/three',
  '@zxing/browser',
  '@zxing/library',
  'class-variance-authority',
  'clsx',
  'lucide-react',
  'qrcode.react',
  'radix-ui',
  'react',
  'react-day-picker',
  'react-dom',
  'swr',
  'tailwind-merge',
  'three',
  'zustand',
]);

const FRONTEND_ONLY_DEV = new Set([
  '@opennextjs/cloudflare',
  '@tailwindcss/postcss',
  '@types/react',
  '@types/react-dom',
  'concurrently',
  'eslint',
  'eslint-config-next',
  'tailwindcss',
  'tsx',
  'wrangler',
]);

async function copyDir(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true, force: true });
}

async function patchBridgeImports(dir) {
  const { readdir, readFile, writeFile: write } = await import('node:fs/promises');
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) await patchBridgeImports(full);
    else if (ent.name.endsWith('.ts')) {
      let text = await readFile(full, 'utf8');
      const next = text
        .replaceAll("from '../lib/json", "from '../bridge/json")
        .replaceAll("from '../lib/next-bridge", "from '../bridge/next-bridge")
        .replaceAll("from '../lib/router", "from '../bridge/router");
      if (next !== text) await write(full, next);
    }
  }
}

async function cleanExportDir(out) {
  const preserve = new Set(['.git']);
  if (!existsSync(out)) {
    await mkdir(out, { recursive: true });
    return;
  }
  for (const ent of await readdir(out, { withFileTypes: true })) {
    if (preserve.has(ent.name)) continue;
    await rm(path.join(out, ent.name), { recursive: true, force: true });
  }
}

console.log(`Exporting API repo to ${OUT}`);

await cleanExportDir(OUT);

// Source tree
await copyDir(path.join(ROOT, 'src/lib'), path.join(OUT, 'src/lib'));
await copyDir(path.join(ROOT, 'src/db'), path.join(OUT, 'src/db'));
await copyDir(path.join(ROOT, 'src/app/api'), path.join(OUT, 'src/app/api'));
await copyDir(path.join(ROOT, 'server/src/routes'), path.join(OUT, 'src/routes'));
await copyDir(path.join(ROOT, 'server/src/lib'), path.join(OUT, 'src/bridge'));
await cp(path.join(ROOT, 'server/src/index.ts'), path.join(OUT, 'src/index.ts'));
await cp(path.join(ROOT, 'server/src/app.ts'), path.join(OUT, 'src/app.ts'));
await cp(path.join(ROOT, 'server/src/worker.ts'), path.join(OUT, 'src/worker.ts'));
await cp(
  path.join(ROOT, 'server/src/polyfill-node-globals.ts'),
  path.join(OUT, 'src/polyfill-node-globals.ts'),
);
await cp(
  path.join(ROOT, 'server/src/lib/cors-origins.ts'),
  path.join(OUT, 'src/lib/cors-origins.ts'),
);

let appTs = await readFile(path.join(OUT, 'src/app.ts'), 'utf8');
appTs = appTs.replace("from './lib/api-security.js'", "from './bridge/api-security.js'");
await writeFile(path.join(OUT, 'src/app.ts'), appTs);

await patchBridgeImports(path.join(OUT, 'src/routes'));

// Fix router import path
const routerPath = path.join(OUT, 'src/bridge/router.ts');
let router = await readFile(routerPath, 'utf8');
router = router.replace("from '../routes/registry.js'", "from '../routes/registry.js'");
await writeFile(routerPath, router);

// Scripts
await mkdir(path.join(OUT, 'scripts'), { recursive: true });
let registryScript = await readFile(path.join(ROOT, 'server/scripts/generate-registry.mjs'), 'utf8');
registryScript = registryScript.replace(
  "path.resolve(__dirname, '../../src/app/api')",
  "path.resolve(__dirname, '../src/app/api')",
);
await writeFile(path.join(OUT, 'scripts/generate-registry.mjs'), registryScript);

// package.json
const rootPkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
const serverPkg = JSON.parse(await readFile(path.join(ROOT, 'server/package.json'), 'utf8'));

const dependencies = { ...rootPkg.dependencies, ...serverPkg.dependencies };
for (const key of FRONTEND_ONLY_DEPS) delete dependencies[key];
if (!dependencies.elysia) dependencies.elysia = serverPkg.dependencies.elysia;
if (!dependencies['@elysiajs/cors']) dependencies['@elysiajs/cors'] = serverPkg.dependencies['@elysiajs/cors'];

const devDependencies = {
  '@types/bun': '^1.2.0',
  '@types/node': rootPkg.devDependencies['@types/node'],
  '@types/node-cron': rootPkg.devDependencies['@types/node-cron'],
  '@types/pg': rootPkg.devDependencies['@types/pg'],
  '@types/web-push': rootPkg.devDependencies['@types/web-push'],
  typescript: rootPkg.devDependencies.typescript,
  dotenv: rootPkg.devDependencies.dotenv,
  'drizzle-kit': rootPkg.devDependencies['drizzle-kit'],
  wrangler: rootPkg.devDependencies.wrangler || '^4.99.0',
};

const apiPkg = {
  name: 'psusccshop-api',
  version: '1.0.0',
  private: true,
  type: 'module',
  engines: { bun: '>=1.2.0' },
  scripts: {
    dev: 'bun --watch --env-file=.env src/index.ts',
    'dev:worker': 'wrangler dev',
    start: 'bun src/index.ts',
    deploy: 'wrangler deploy',
    typecheck: 'tsc --noEmit',
    'generate:registry': 'node scripts/generate-registry.mjs',
  },
  dependencies,
  devDependencies,
};

await writeFile(path.join(OUT, 'package.json'), JSON.stringify(apiPkg, null, 2) + '\n');

// tsconfig
await writeFile(
  path.join(OUT, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
      include: ['src/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2,
  ) + '\n',
);

// Dockerfile (standalone)
await writeFile(
  path.join(OUT, 'Dockerfile'),
  `FROM oven/bun:1.2-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --production

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 3001

# Railway/Render inject PORT; API uses PORT || API_PORT
CMD ["bun", "src/index.ts"]
`,
);

// Cloudflare Workers (primary deploy target)
await cp(path.join(ROOT, 'server/wrangler.jsonc'), path.join(OUT, 'wrangler.jsonc'));

// GitHub Actions
await mkdir(path.join(OUT, '.github/workflows'), { recursive: true });
await writeFile(
  path.join(OUT, '.github/workflows/ci.yml'),
  `name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install
      - run: bun run generate:registry
      - run: bun run typecheck
      - name: Smoke test (Bun)
        env:
          API_PORT: 3099
          NEXTAUTH_SECRET: ci-smoke-test-secret-min-32-chars-long
          DATABASE_URL: postgresql://ci:ci@localhost:5432/ci
          NEXT_PUBLIC_SUPABASE_URL: https://ci-placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder-anon-key
        run: |
          bun src/index.ts &
          sleep 3
          curl -sf http://localhost:3099/api/health

  deploy:
    needs: verify
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install
      - run: bun run generate:registry
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
`,
);

// .gitignore
await writeFile(
  path.join(OUT, '.gitignore'),
  `node_modules/
npm-cache/
.wrangler/
.dev.vars
.env
.env.local
.env.*.local
.DS_Store
`,
);

// README
await writeFile(
  path.join(OUT, 'README.md'),
  `# psusccshop-api

Elysia + Bun API server for SCC Shop (exported from [psusccshop](https://github.com/swr2photo/psusccshop)).

## Run (local — Bun)

\`\`\`bash
bun install
cp .env.example .env
bun run dev          # http://localhost:3001/api/health
\`\`\`

## Run (local — Cloudflare Workers)

\`\`\`bash
bun run dev:worker   # http://localhost:8787/api/health
\`\`\`

## Sync from monorepo

\`\`\`bash
cd ../psusccshop
npm run sync:api-repo
\`\`\`

## Deploy — Cloudflare Workers (แนะนำ)

### ครั้งแรก

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create**
2. เลือก **Connect to Git** → repo \`swr2photo/psusccshop-api\`
3. Build settings:
   - **Build command:** \`bun install && bun run generate:registry\`
   - **Deploy command:** \`bunx wrangler deploy\`
   - หรือใช้ GitHub Actions (ตั้ง \`CLOUDFLARE_API_TOKEN\`, \`CLOUDFLARE_ACCOUNT_ID\`)
4. **Hyperdrive** (จำเป็นสำหรับ PostgreSQL บน Workers):
   - Dashboard → Hyperdrive → Create → ใส่ \`DATABASE_URL\`
   - แก้ \`wrangler.jsonc\` เพิ่ม binding \`HYPERDRIVE\`
5. **Secrets** (Workers → Settings → Variables):
   \`NEXTAUTH_SECRET\`, Supabase keys, Filebase keys ฯลฯ (คัดลอกจาก Vercel)
   - CLI: \`wrangler secret put NEXTAUTH_SECRET\`
6. **Custom domain:** \`api.psuscc.club\` → Workers → Domains

### Frontend (Vercel)

\`\`\`env
NEXT_PUBLIC_API_URL=https://api.psuscc.club
COOKIE_DOMAIN=.psuscc.club
\`\`\`

ลบ \`API_INTERNAL_URL\` ถ้ามี → redeploy frontend

### Docker (ทางเลือก — local/self-host)

\`\`\`bash
docker build -t psusccshop-api .
docker run -p 3001:3001 --env-file .env psusccshop-api
\`\`\`
`,
);

// .env.example
await writeFile(
  path.join(OUT, '.env.example'),
  `# Local Bun dev
API_PORT=3001

# Must match Vercel frontend
NEXTAUTH_SECRET=
NEXT_PUBLIC_BASE_URL=https://sccshop.psuscc.club

# CORS — comma-separated extra origins
# API_CORS_ORIGINS=https://sccshop.psuscc.club

# PostgreSQL (Bun/Docker — direct connection)
# On Cloudflare Workers use Hyperdrive binding instead (see wrangler.jsonc)
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
`,
);

// Regenerate registry in export
const { spawn } = await import('node:child_process');
await new Promise((resolve, reject) => {
  const p = spawn(process.execPath, ['scripts/generate-registry.mjs'], { cwd: OUT, stdio: 'inherit' });
  p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`registry exit ${code}`))));
});

const hasGit = existsSync(path.join(OUT, '.git'));
console.log(`Done → ${OUT}`);
if (hasGit) {
  console.log(`Sync next:
  cd ${OUT}
  bun install
  git add .
  git commit -m "Sync API from monorepo"
  git push`);
} else {
  console.log(`First-time next:
  cd ${OUT}
  bun install
  git init && git branch -M main
  git add . && git commit -m "Initial psusccshop-api export"
  git remote add origin https://github.com/swr2photo/psusccshop-api.git
  git push -u origin main`);
}
