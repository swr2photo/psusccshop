# Cloudflare Hyperdrive — ขั้นตอนแก้ "Invalid credentials"

## สาเหตุที่พบ
- รหัสผ่านมี `#` → บางครั้ง Dashboard encode ผิด
- ใส่ `?sslmode=require` → ทำให้ fail
- Direct `db....supabase.co` เป็น IPv6 — เครื่องคุณอาจ resolve ไม่ได้ (Hyperdrive บน Cloudflare ใช้ได้)

## วิธีที่แนะนำ (ทำตามลำดับ)

### ขั้น 1 — Reset password ใน Supabase (แก้ถาวร)
1. [Supabase Dashboard](https://supabase.com/dashboard/project/dqecqtmebioqhrkusahz/database/settings)
2. **Database password → Reset**
3. ตั้งรหัสใหม่: **ตัวอักษร+ตัวเลขอย่างเดียว** (ไม่มี `#`, `@`, `/`)
4. **Connect** → **Session pooler** → **URI** → copy ทั้งบรรทัด
5. อัปเดต `.env` → `DATABASE_URL=...` (port 5432 หรือ 6543 ตามที่ copy มา)

### ขั้น 2 — สร้าง Hyperdrive
**Dashboard:** Hyperdrive → Create → วาง connection string จากขั้น 1  
**Caching:** ปิด  
**อย่าใส่** `?sslmode=require`

**หรือ CLI:**
```powershell
cd d:\shop\psusccshop-api
npx wrangler login
npx wrangler hyperdrive create psusccshop-api --connection-string="postgresql://..."
```

### ขั้น 3 — Bind ใน wrangler.jsonc
```jsonc
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }]
```
Push → redeploy Worker

### ขั้น 4 — Secrets บน Workers (ใส่ทีเดียว)

จาก monorepo (อ่านจาก `.env` → สร้าง `psusccshop-api/.dev.vars`):

```powershell
cd d:\shop\psusccshop
npm run secrets:workers

cd ..\psusccshop-api
npx wrangler login
npx wrangler secret bulk .dev.vars
```

- อัปโหลดครั้งเดียว ~60 ตัว (ข้าม `DATABASE_URL` — ใช้ Hyperdrive แทน)
- ตั้ง `NEXTAUTH_URL`, `COOKIE_DOMAIN` ให้อัตโนมัติ
- `.dev.vars` อยู่ใน `.gitignore` — **อย่า commit**

### ขั้น 5 — Vercel frontend (split deploy)

```powershell
cd d:\shop\psusccshop
npx vercel login
npx vercel link
npm run env:vercel
# redeploy: npx vercel --prod
```

หรือตั้ง manual ใน Dashboard:

```
NEXT_PUBLIC_API_URL=https://api.psuscc.club
COOKIE_DOMAIN=.psuscc.club
NEXTAUTH_URL=https://sccshop.psuscc.club
```

**ลบ** `API_INTERNAL_URL` ถ้ามี — โค้ดใช้ `apiFetch` เรียก Workers โดยตรงแล้ว

---

## ลอง string ปัจจุบัน (Session pooler 5432, ไม่มี sslmode)
รัน `npm run hyperdrive:setup` ใน monorepo เพื่อพิมพ์ string ล่าสุดจาก `.env`
