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

| Service | URL |
|---------|-----|
| Frontend | `https://sccshop.psusci.club` |
| API | `https://api.psuscc.club` |

`NEXT_PUBLIC_API_URL` บน Vercel + CORS บน Elysia

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
