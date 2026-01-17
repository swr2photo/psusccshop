# Copilot Instructions for psusccshop

**Project Snapshot**
- Next.js 16 App Router with client-heavy MUI screens; storefront in [src/app/page.tsx](src/app/page.tsx), admin console in [src/app/admin/page.tsx](src/app/admin/page.tsx).
- State via Zustand for cart persistence [src/store/cartStore.ts](src/store/cartStore.ts); custom toast/profile/payment modals under [src/components](src/components).

**Auth & Access Control**
- Google OAuth handled by NextAuth config [src/app/api/auth/[...nextauth]/route.ts](src/app/api/auth/%5B...nextauth%5D/route.ts); use `requireAuth`/`requireAdmin` from [src/lib/auth.ts](src/lib/auth.ts) inside API routes to gate users and admins (static + dynamic admin lists from Filebase config).
- Email ownership checks use `isResourceOwner` and SHA-256 hashed keys to avoid exposing email in storage.

**Data Storage (Filebase S3)**
- S3 helper [src/lib/filebase.ts](src/lib/filebase.ts) wraps `getJson`/`putJson`/`listKeys`/`deleteObject` with retries; bucket/creds pulled from env.
- Orders saved as JSON under `orders/YYYY-MM/<ref>.json`; indexes per customer at `orders/index/<sha256(email)>.json` for fast history. Keep index in sync when mutating orders.
- Cart and profile data hashed by email: `carts/<sha>.json`, `users/<sha>.json` ([src/app/api/cart/route.ts](src/app/api/cart/route.ts), [src/app/api/profile/route.ts](src/app/api/profile/route.ts)).
- Shop config stored at `config/shop-settings.json` and served via [src/app/api/config/route.ts](src/app/api/config/route.ts); admin dashboard fetches config+orders in [src/app/api/admin/data/route.ts](src/app/api/admin/data/route.ts).

**Order & Payment Flow**
- Client calls in [src/lib/api-client.ts](src/lib/api-client.ts) hit internal `/api/*` endpoints (no caching, JSON only). `getHistory` paginates using order index; `saveCart`/`saveProfile` respect auth/ownership.
- Payment info endpoint computes totals and PromptPay QR via [src/app/api/payment-info/route.ts](src/app/api/payment-info/route.ts) and [src/lib/payment-utils.ts](src/lib/payment-utils.ts) (uses `PROMPTPAY_ID`, optional bank/account envs).
- Slip upload/verification in [src/app/api/payment/verify/route.ts](src/app/api/payment/verify/route.ts) (requires login; checks owner or admin). Uses SlipOK API (`SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID`) to validate amount/duplicate/receiver, marks order `PAID`, and updates the email index. Admin-only slip viewer at [src/app/api/slip/[ref]/route.ts](src/app/api/slip/%5Bref%5D/route.ts).
- Admin status changes go through [src/app/api/admin/status/route.ts](src/app/api/admin/status/route.ts); normal order mutations still require owner check in [src/app/api/orders/route.ts](src/app/api/orders/route.ts).

**Integrations**
- Google Sheets sync/export lives in [src/app/api/admin/sheet/route.ts](src/app/api/admin/sheet/route.ts); needs `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY`. Creates/ensures sheets, exports order rows, vendor view, and factory size breakdown; base URL pulled from `NEXT_PUBLIC_BASE_URL` or host for slip links.
- Image upload to Filebase/IPFS via [src/app/api/upload/route.ts](src/app/api/upload/route.ts); accepts base64 images only, ≤5MB, validates magic bytes, returns CID-based gateway URL when available.

**Front-End Notes**
- Storefront/admin components assume Thai labels/status mappings defined in page/admin files; statuses normalized via `STATUS_*` maps and shared helpers (keep consistent when adding new statuses).
- Configurable products/announcements/bank info come from config API; admin UI pushes updates through `saveShopConfig` in `api-client`.

**Environment Essentials**
- Required: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, Google OAuth (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), Filebase (`FILEBASE_*`), GAS URL (`NEXT_PUBLIC_GAS_URL`) for legacy client calls, PromptPay (`PROMPTPAY_ID`), optional payment display (`PAYMENT_BANK`, `PAYMENT_ACCOUNT_NAME`, `PAYMENT_ACCOUNT`), SlipOK keys, Google service account for sheets.

**Dev Workflow**
- Scripts: `npm run dev` (Next dev), `npm run build`, `npm run start`, `npm run lint` ([package.json](package.json)).
- Some API routes pin `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` (Filebase/Google APIs); avoid converting them to edge.

**When Updating**
- Preserve order index consistency when changing order writes (create/update/delete/verify). If you add new order fields, ensure sheet export and payment info mapping stay aligned.
- Keep base64 slip data and CID/image keys private to admins; public endpoints should continue to scrub emails via hashed paths.
