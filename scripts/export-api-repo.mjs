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

await patchBridgeImports(path.join(OUT, 'src/routes'));

// Fix router import path
const routerPath = path.join(OUT, 'src/bridge/router.ts');
let router = await readFile(routerPath, 'utf8');
router = router.replace("from '../routes/registry.js'", "from '../routes/registry.js'");
await writeFile(routerPath, router);

// Scripts
await mkdir(path.join(OUT, 'scripts'), { recursive: true });
let registryScript = await readFile(path.join(ROOT, 'server/scripts/generate-registry.mjs'), 'utf8');
registryScript = registryScript
  .replace('../../src/app/api', '../src/app/api')
  .replace('../src/routes/registry.ts', '../src/routes/registry.ts')
  .replace('node server/scripts/generate-registry.mjs', 'node scripts/generate-registry.mjs');
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
};

const apiPkg = {
  name: 'psusccshop-api',
  version: '1.0.0',
  private: true,
  type: 'module',
  engines: { bun: '>=1.2.0' },
  scripts: {
    dev: 'bun --watch --env-file=.env src/index.ts',
    start: 'bun src/index.ts',
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

ENV API_PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

CMD ["bun", "src/index.ts"]
`,
);

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
      - run: bun run typecheck
      - name: Smoke test
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

  docker:
    needs: verify
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/\${{ github.repository }}:latest
            ghcr.io/\${{ github.repository }}:\${{ github.sha }}
`,
);

// .gitignore
await writeFile(
  path.join(OUT, '.gitignore'),
  `node_modules/
npm-cache/
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

## Run

\`\`\`bash
bun install
cp .env.example .env   # fill in secrets
bun run dev
\`\`\`

Health: \`GET /api/health\`

## Sync from monorepo

\`\`\`bash
cd ../psusccshop
node scripts/export-api-repo.mjs
\`\`\`

## Deploy

- Docker: \`docker build -t psusccshop-api .\`
- GitHub Actions builds & pushes to GHCR on push to \`main\`
`,
);

// .env.example
await writeFile(
  path.join(OUT, '.env.example'),
  `API_PORT=3001
NEXTAUTH_SECRET=
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_BASE_URL=https://sccshop.psusci.club
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
