# Copilot Instructions for psusccshop

## Project Snapshot
- Next.js 16 App Router with client-heavy MUI screens
- Storefront in src/app, Admin in src/app/admin
- State via Zustand (cart) in src/store
- UI components in src/components

## Auth & Access Control
- Multi-provider OAuth via NextAuth (Google, Microsoft, Facebook, Apple, LINE) in src/app/api/auth
- Auth helpers in src/lib (requireAuth/requireAdmin for API routes)
- Email ownership via isResourceOwner + SHA-256 hashed keys

## Data Storage (Filebase S3)
- S3 helper in src/lib (getJson/putJson/listKeys/deleteObject)
- Orders: orders/YYYY-MM/REF.json, Index: orders/index/SHA256.json
- Cart/Profile: carts/SHA.json, users/SHA.json
- Config: config/shop-settings.json via API config route

## Order & Payment Flow
- API client in src/lib → /api/* endpoints
- Payment info API + payment utils in src/lib
- Slip verify via SlipOK API
- Admin status change API
- Orders CRUD API
- Auto sync to Sheets (debounced 2s, rate-limited 5s)

## Integrations
- Google Sheets sync via admin sheet API (needs GOOGLE_CLIENT_EMAIL/GOOGLE_PRIVATE_KEY)
- Image upload API (Filebase/IPFS, ≤5MB)

## Environment Variables
Required: NEXTAUTH_SECRET, NEXTAUTH_URL, GOOGLE_CLIENT_ID/SECRET, FILEBASE_*, NEXT_PUBLIC_GAS_URL, PROMPTPAY_ID, SLIPOK_API_KEY/BRANCH_ID, GOOGLE_CLIENT_EMAIL/PRIVATE_KEY
Optional OAuth: AZURE_AD_CLIENT_ID/CLIENT_SECRET/TENANT_ID, FACEBOOK_CLIENT_ID/CLIENT_SECRET, APPLE_ID/APPLE_SECRET, LINE_CLIENT_ID/CLIENT_SECRET

## Dev Commands
- npm run dev, npm run build, npm run start, npm run lint
- Some routes use runtime='nodejs' + dynamic='force-dynamic'

## When Updating
- Keep order index in sync on writes
- Update sheet export when adding order fields
- Keep slip data private to admins
