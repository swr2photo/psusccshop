# แยก Frontend / Backend (Next.js + ElysiaJS)

## โครงสร้าง

```
psusccshop/
├── src/app/             # Next.js — หน้าบ้าน + Admin UI
├── src/app/api/auth/    # NextAuth + Passkey (อยู่ที่ Next.js เท่านั้น)
├── server/              # Elysia API — หลังบ้าน (พอร์ต 3001)
└── src/lib/             # Domain logic ร่วม
```

| ส่วน | เทคโนโลยี | หน้าที่ |
|------|-----------|---------|
| Frontend | Next.js 16 | UI, OAuth/Passkey, middleware (rate limit, CORS) |
| Backend | ElysiaJS + **Bun** | **69 API routes** ผ่าน Next bridge |

## Routes

| อยู่ที่ | Routes |
|--------|--------|
| **Elysia** | ทุก `/api/*` ยกเว้น `/api/auth/*` (69 routes) |
| **Next.js** | `/api/auth/[...nextauth]`, passkey, available-providers |

Elysia ไม่ได้เขียน logic ใหม่ — ใช้ **next-bridge** เรียก handler เดิมจาก `src/app/api/**/route.ts`

## รัน Local

```bash
# ติดตั้ง Bun: https://bun.sh
bun install          # หรือ npm install

# รันทั้งคู่
npm run dev:all

# หรือแยก terminal
npm run dev          # Next.js → :3000
npm run dev:api      # Elysia/Bun → :3001
bun run --cwd server start   # production local
```

### Environment

```env
# โหมด proxy — Next middleware ส่งต่อ /api/* ไป Elysia (ยกเว้น auth)
API_INTERNAL_URL=http://localhost:3001

# โหมดแยก deploy — browser เรียก API โดยตรง
# NEXT_PUBLIC_API_URL=https://api.psuscc.club

API_PORT=3001
NEXTAUTH_SECRET=...
DATABASE_URL=...
```

## เพิ่ม API route ใหม่

1. สร้าง `src/app/api/.../route.ts` ตามปกติ
2. รัน `npm run generate:api-registry` (อัปเดต registry อัตโนมัติ)
3. Route ใหม่จะทำงานบน Elysia ทันที (ยกเว้นอยู่ใต้ `/api/auth/`)

## Deploy

### A) Proxy ผ่าน Next (พัฒนา / Vercel เดียว)

`API_INTERNAL_URL` บน Vercel → middleware proxy → Elysia

### B) แยกโดเมน (production)

| Service | URL | Platform |
|---------|-----|----------|
| Frontend | `https://sccshop.psuscc.club` | Vercel |
| API | `https://api.psuscc.club` | **Cloudflare Workers** (Bun local dev) |

**Frontend (Vercel env):**
```env
NEXT_PUBLIC_API_URL=https://api.psuscc.club
COOKIE_DOMAIN=.psuscc.club
NEXTAUTH_URL=https://sccshop.psuscc.club
# อย่าตั้ง API_INTERNAL_URL
```

**API (Cloudflare Workers):** คัดลอก secrets จาก Vercel + ตั้ง Hyperdrive สำหรับ PostgreSQL:
```env
NEXT_PUBLIC_BASE_URL=https://sccshop.psuscc.club
NEXTAUTH_SECRET=<same as frontend>
```

**Deploy API บน Cloudflare Workers:**
1. dash.cloudflare.com → Workers → Connect Git → `psusccshop-api`
2. สร้าง **Hyperdrive** → bind ใน `wrangler.jsonc` (`HYPERDRIVE`)
3. ตั้ง secrets ผ่าน Dashboard หรือ `wrangler secret put`
4. Custom domain `api.psuscc.club`
5. อัปเดต `NEXT_PUBLIC_API_URL` บน Vercel → redeploy frontend

Local Workers dev: `cd psusccshop-api && bun run dev:worker` (port 8787)

Session cookie ใช้ร่วม subdomain ได้เมื่อ `COOKIE_DOMAIN=.psuscc.club`

### Docker API (Bun)

```bash
docker build -f server/Dockerfile -t psusccshop-api .
docker run -p 3001:3001 --env-file .env.local psusccshop-api
```

### GitHub Actions

Push ไป `main` (เมื่อแก้ `server/` หรือ `src/app/api/`) จะรัน workflow **API Server (Bun)**:
- typecheck + smoke test `/api/health`
- build & push image ไป `ghcr.io/<owner>/<repo>/api:latest`

ดึง image:
```bash
docker pull ghcr.io/<owner>/<repo>/api:latest
```

## Repo แยก (`psusccshop-api`)

Monorepo ยัง deploy ได้จาก `server/` + Docker ใน repo หลัก  
ถ้าต้องการ **repo คนละตัว** ให้ export โฟลเดอร์ standalone:

**ครั้งแรก (export + สร้าง repo):**

```bash
npm run export:api-repo
cd ../psusccshop-api
bun install
git init && git add . && git commit -m "Initial psusccshop-api export"
git remote add origin https://github.com/swr2photo/psusccshop-api.git
git push -u origin main
```

**ทุกครั้งที่แก้ API ใน monorepo แล้ว sync:**

```bash
# 1) ใน psusccshop — export ทับ ../psusccshop-api
npm run sync:api-repo

# 2) ใน psusccshop-api — commit + push
cd ../psusccshop-api
bun install
git add .
git commit -m "Sync API from monorepo"
git push
```

โครงสร้าง repo แยก:

```
psusccshop-api/
├── src/index.ts       # Elysia entry
├── src/bridge/        # next-bridge, router
├── src/routes/        # health + proxy + registry
├── src/app/api/       # Next route handlers (69 routes)
├── src/lib/ + src/db/ # shared logic
└── Dockerfile         # Bun alpine
```
