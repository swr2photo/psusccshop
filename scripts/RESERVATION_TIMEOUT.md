# Order Reservation Timeout

When a customer places an order, stock is **deducted immediately** and held until payment succeeds or the reservation expires.

## Behaviour

| Event | Stock |
|--------|--------|
| Order created (`WAITING_PAYMENT`) | Deduct via `deduct_stock` |
| Paid / verifying | Keep deducted |
| Cancel (user / admin) | Restore via `restore_stock` (once) |
| Reservation timeout (cron / client / payment countdown) | Cancel + restore |

Default window: **24 hours** from `createdAt`.

## Configure

```env
# Server (cron + cancel APIs)
ORDER_RESERVATION_HOURS=24

# Client countdown / badge (must match server)
NEXT_PUBLIC_ORDER_RESERVATION_HOURS=24
```

## One-time SQL

Run on Supabase/Postgres:

```bash
# SQL Editor or psql
\i scripts/restore-stock.sql
```

Or apply the `restore_stock` function from `scripts/supabase-phase2-schema.sql`.

Without this function, cancel still runs; stock restore falls back to a direct `UPDATE inventory` (and logs a warning if the row is missing).

## Cron

- Railway / worker: `cancel-expired` every ~30 minutes (preferred)
- Vercel `/api/cron`: daily — fine as backup; prefer 30m for timely stock release

## Code

- `src/lib/order-reservation.ts` — helpers
- `src/app/api/cron/cancel-expired/route.ts` — timeout job
- `src/app/api/orders/route.ts` — create + cancel restore
- `src/app/api/admin/status/route.ts` — admin cancel restore
