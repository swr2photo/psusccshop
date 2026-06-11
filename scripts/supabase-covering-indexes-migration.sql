-- ============================================================================
-- Covering indexes (PostgreSQL INCLUDE) for hot read paths
-- ============================================================================
-- Purpose:
--   Enable index-only scans for admin order list, user order history,
--   email log list, and user activity logs — without heap fetches for
--   frequently selected scalar columns.
--
-- Does NOT include heavy columns (cart, slip_data, body, metadata jsonb).
-- Those still require heap access when selected with SELECT *.
--
-- Apply (Supabase SQL editor or psql):
--   \i scripts/supabase-covering-indexes-migration.sql
--
-- Production tip — build without blocking writes (run each statement alone):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS ...
--
-- Verify usage after deploy:
--   EXPLAIN (ANALYZE, BUFFERS)
--   SELECT ref, status, customer_name, customer_email, total_amount, created_at
--   FROM orders ORDER BY created_at DESC LIMIT 100;
--   -- expect: Index Only Scan using idx_orders_created_admin_covering
--
-- Rollback: see section at bottom.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ORDERS — admin list (GET /api/admin/orders-list)
--    Pattern: ORDER BY created_at DESC LIMIT/OFFSET [+ optional status filter]
--    Replaces heap fetches for list columns; cart/slip still from table when needed.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created_admin_covering
  ON public.orders (created_at DESC)
  INCLUDE (
    ref,
    status,
    customer_name,
    customer_email,
    customer_phone,
    total_amount,
    shipping_option,
    tracking_number,
    shop_id,
    payment_verified,
    date
  );

-- Filter by status + sort by newest (admin status chips / filtered views)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_covering
  ON public.orders (status, created_at DESC)
  INCLUDE (
    ref,
    customer_name,
    customer_email,
    total_amount,
    shipping_option,
    tracking_number,
    shop_id
  );

-- ----------------------------------------------------------------------------
-- 2. ORDERS — user order history (getOrdersByEmail)
--    Pattern: WHERE email_hash = ? ORDER BY created_at DESC
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_email_created_covering
  ON public.orders (email_hash, created_at DESC)
  INCLUDE (
    ref,
    status,
    total_amount,
    date,
    shipping_option,
    shop_slug,
    payment_verified
  );

-- ----------------------------------------------------------------------------
-- 3. ORDERS — multi-shop admin (optional; skip if shop_id column unused)
--    Pattern: WHERE shop_id = ? ORDER BY created_at DESC
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_shop_created_covering
  ON public.orders (shop_id, created_at DESC)
  INCLUDE (ref, status, customer_name, customer_email, total_amount)
  WHERE shop_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. EMAIL_LOGS — admin email tab (getEmailLogsFromDb)
--    Pattern: ORDER BY created_at DESC LIMIT N
--    body TEXT intentionally excluded (too large for covering index)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_el_created_list_covering
  ON public.email_logs (created_at DESC)
  INCLUDE (
    id,
    to_email,
    from_email,
    subject,
    email_type,
    status,
    order_ref,
    sent_at,
    error
  );

-- Lookup by order ref (send_order_status, per-order email history)
CREATE INDEX IF NOT EXISTS idx_el_order_ref_created_covering
  ON public.email_logs (order_ref, created_at DESC)
  INCLUDE (to_email, subject, email_type, status, sent_at)
  WHERE order_ref IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. USER_LOGS — admin activity tab (getUserLogsPaginated)
--    Pattern: ORDER BY created_at DESC [+ filter email / action / date]
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ul_created_list_covering
  ON public.user_logs (created_at DESC)
  INCLUDE (id, email, name, action, details, ip, user_agent);

CREATE INDEX IF NOT EXISTS idx_ul_email_created_covering
  ON public.user_logs (email, created_at DESC)
  INCLUDE (id, name, action, details, ip, user_agent)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ul_action_created_covering
  ON public.user_logs (action, created_at DESC)
  INCLUDE (id, email, name, details)
  WHERE action IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. Optional cleanup — drop redundant btree indexes AFTER verifying new ones
--    (old indexes are subsets of key columns; covering indexes can serve same paths)
--    Uncomment only after EXPLAIN confirms index-only scans on production traffic.
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.idx_orders_created_desc;
-- DROP INDEX IF EXISTS public.idx_el_created_desc;
-- DROP INDEX IF EXISTS public.idx_ul_created_desc;

-- ----------------------------------------------------------------------------
-- ROLLBACK (manual)
-- ----------------------------------------------------------------------------
-- DROP INDEX IF EXISTS public.idx_orders_created_admin_covering;
-- DROP INDEX IF EXISTS public.idx_orders_status_created_covering;
-- DROP INDEX IF EXISTS public.idx_orders_email_created_covering;
-- DROP INDEX IF EXISTS public.idx_orders_shop_created_covering;
-- DROP INDEX IF EXISTS public.idx_el_created_list_covering;
-- DROP INDEX IF EXISTS public.idx_el_order_ref_created_covering;
-- DROP INDEX IF EXISTS public.idx_ul_created_list_covering;
-- DROP INDEX IF EXISTS public.idx_ul_email_created_covering;
-- DROP INDEX IF EXISTS public.idx_ul_action_created_covering;
-- Then recreate legacy indexes if dropped:
-- CREATE INDEX IF NOT EXISTS idx_orders_created_desc ON public.orders (created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_el_created_desc ON public.email_logs (created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_ul_created_desc ON public.user_logs (created_at DESC);

-- ----------------------------------------------------------------------------
-- Post-migration: refresh planner statistics
-- ----------------------------------------------------------------------------
ANALYZE public.orders;
ANALYZE public.email_logs;
ANALYZE public.user_logs;
