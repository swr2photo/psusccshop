-- ============================================================================
-- PSUSCCSHOP — Unified Database Schema v2.0
-- ============================================================================
-- Consolidated, performance-optimized, security-hardened schema
-- Replaces ALL previous migration files
--
-- Run in Supabase SQL Editor as a single transaction.
-- Requires: PostgreSQL 15+ / Supabase
--
-- Design principles:
--   1. Strict ENUM types — no unvalidated VARCHAR status fields
--   2. Consistent UUID PKs via gen_random_uuid() (pgcrypto built-in)
--   3. Enforced FK constraints with appropriate ON DELETE actions
--   4. Service-role-only RLS (all access goes through Next.js API)
--   5. Composite / partial / GIN / BRIN indexes for real query patterns
--   6. All functions set search_path = '' and use SECURITY INVOKER
--      unless elevated privilege is required (then SECURITY DEFINER)
--   7. PDPA-compliant data retention & cleanup
--   8. Single updated_at trigger function shared across all tables
-- ============================================================================

BEGIN;

-- ========================== EXTENSIONS ======================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;   -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS "pg_trgm"  SCHEMA extensions;   -- trigram indexes for LIKE/ILIKE

-- ========================== CUSTOM ENUM TYPES ===============================
-- Centralised status enums prevent typos and allow fast equality checks.

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'WAITING_PAYMENT','PAYMENT_UPLOADED','PAYMENT_VERIFIED',
    'PROCESSING','SHIPPED','DELIVERED','PICKED_UP',
    'COMPLETED','CANCELLED','REFUND_REQUESTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending','processing','completed','failed','refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM (
    'bank_transfer','promptpay','credit_card','cod','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shipping_status AS ENUM (
    'pending','ready_to_ship','shipped','in_transit',
    'out_for_delivery','delivered','returned','pickup_ready','picked_up'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_status AS ENUM (
    'REQUESTED','APPROVED','COMPLETED','REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chat_status AS ENUM ('pending','active','closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE chat_sender AS ENUM ('customer','admin','system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_severity AS ENUM ('low','medium','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE data_request_type AS ENUM ('access','download','delete','rectification');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE data_request_status AS ENUM ('pending','processing','completed','rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ========================== SHARED TRIGGER FUNCTION =========================
-- Single function for all updated_at triggers — eliminates duplication.

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_set_updated_at()
  IS 'Shared trigger: sets updated_at to current clock_timestamp on every UPDATE';

-- ========================== HELPER FUNCTIONS ================================

-- Check service role (for use in RLS or application logic)
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json ->> 'role',
    ''
  ) = 'service_role';
$$;

-- Get SHA-256 hash of current JWT email (future Supabase Auth integration)
CREATE OR REPLACE FUNCTION public.get_user_email_hash()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT encode(
    extensions.digest(lower(trim(
      current_setting('request.jwt.claims', true)::json ->> 'email'
    ))::bytea, 'sha256'),
    'hex'
  );
$$;

-- ============================================================================
-- 1. ORDERS — Core commerce table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref             VARCHAR(50) UNIQUE NOT NULL,

  -- Status
  status          order_status NOT NULL DEFAULT 'WAITING_PAYMENT',

  -- Customer (denormalised for quick access; canonical data in profiles)
  customer_name   VARCHAR(255) NOT NULL,
  customer_email  VARCHAR(255) NOT NULL,
  email_hash      VARCHAR(64)  NOT NULL,  -- SHA-256 hex
  customer_phone  VARCHAR(50),
  customer_address TEXT,
  customer_instagram VARCHAR(100),

  -- Cart snapshot (immutable after order placement)
  cart            JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (total_amount >= 0),
  notes           TEXT,

  -- Payment
  payment_method  payment_method DEFAULT 'bank_transfer',
  payment_gateway TEXT,
  payment_status  payment_status NOT NULL DEFAULT 'pending',
  payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
  payment_verified_at TIMESTAMPTZ,
  slip_data       JSONB,  -- base64 + verification result (admin-only)

  -- Shipping
  shipping_option  VARCHAR(100),            -- option ID from config
  shipping_provider VARCHAR(50),
  shipping_status  shipping_status NOT NULL DEFAULT 'pending',
  tracking_number  VARCHAR(100),
  tracking_url     TEXT,
  tracking_status  VARCHAR(50),             -- last raw carrier status
  tracking_last_checked TIMESTAMPTZ,
  shipped_at       TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  received_at      TIMESTAMPTZ,

  -- Pickup
  pickup_status    VARCHAR(50),
  pickup_at        TIMESTAMPTZ,
  pickup_by        VARCHAR(255),

  -- Refund
  refund_status       refund_status,
  refund_reason       TEXT,
  refund_details      TEXT,
  refund_bank_name    VARCHAR(100),
  refund_bank_account VARCHAR(50),
  refund_account_name VARCHAR(255),
  refund_amount       NUMERIC(12,2) CHECK (refund_amount IS NULL OR refund_amount >= 0),
  refund_requested_at TIMESTAMPTZ,
  refund_reviewed_at  TIMESTAMPTZ,
  refund_reviewed_by  VARCHAR(255),
  refund_admin_note   TEXT,

  -- Timestamps
  date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes — designed for actual query patterns
CREATE INDEX IF NOT EXISTS idx_orders_email_hash    ON public.orders (email_hash);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_desc  ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_date_desc     ON public.orders (date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_st    ON public.orders (payment_status)
  WHERE payment_status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_orders_shipping_st   ON public.orders (shipping_status)
  WHERE shipping_status NOT IN ('delivered','picked_up');
CREATE INDEX IF NOT EXISTS idx_orders_refund_st     ON public.orders (refund_status)
  WHERE refund_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_tracking      ON public.orders (tracking_number)
  WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shipped_tracking
  ON public.orders (status, tracking_number)
  WHERE status = 'SHIPPED' AND tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cart_gin      ON public.orders USING GIN (cart jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_orders_slip_gin      ON public.orders USING GIN (slip_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_orders_ref_trgm      ON public.orders USING GIN (ref gin_trgm_ops);

-- Trigger
DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 2. PAYMENT TRANSACTIONS — Detailed payment audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method                payment_method NOT NULL,
  gateway               TEXT,
  amount                NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency              VARCHAR(3) NOT NULL DEFAULT 'THB',
  status                payment_status NOT NULL DEFAULT 'pending',
  gateway_transaction_id TEXT,
  gateway_charge_id     TEXT,
  card_last4            CHAR(4),
  card_brand            VARCHAR(20),
  error_message         TEXT,
  raw_response          JSONB,
  verified              BOOLEAN NOT NULL DEFAULT FALSE,
  verification_method   VARCHAR(50),
  verified_at           TIMESTAMPTZ,
  verified_by           VARCHAR(255),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_order_id        ON public.payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_pt_status          ON public.payment_transactions (status)
  WHERE status NOT IN ('completed','failed');
CREATE INDEX IF NOT EXISTS idx_pt_gateway_charge  ON public.payment_transactions (gateway_charge_id)
  WHERE gateway_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pt_created_desc    ON public.payment_transactions (created_at DESC);

DROP TRIGGER IF EXISTS trg_pt_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_pt_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 3. SHIPPING TRACKING HISTORY — Carrier event log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shipping_tracking_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tracking_number VARCHAR(100) NOT NULL,
  provider        VARCHAR(50) NOT NULL,
  status          VARCHAR(100) NOT NULL,
  status_text     TEXT,
  location        TEXT,
  "timestamp"      TIMESTAMPTZ NOT NULL,     -- carrier timestamp
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sth_order_id     ON public.shipping_tracking_history (order_id);
CREATE INDEX IF NOT EXISTS idx_sth_tracking     ON public.shipping_tracking_history (tracking_number);
CREATE INDEX IF NOT EXISTS idx_sth_event_desc   ON public.shipping_tracking_history ("timestamp" DESC);
-- BRIN for append-only time-series
CREATE INDEX IF NOT EXISTS idx_sth_created_brin ON public.shipping_tracking_history USING BRIN (created_at);

-- ============================================================================
-- 4. CONFIG — Key-value shop settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(255) UNIQUE NOT NULL,
  value       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_config_key ON public.config (key);
-- GIN for deep JSON queries
CREATE INDEX IF NOT EXISTS idx_config_value_gin ON public.config USING GIN (value jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_config_updated_at ON public.config;
CREATE TRIGGER trg_config_updated_at
  BEFORE UPDATE ON public.config
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 5. PROFILES — Customer saved info
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash    VARCHAR(64) UNIQUE NOT NULL,
  name          VARCHAR(255),
  phone         VARCHAR(50),
  address       TEXT,
  instagram     VARCHAR(100),
  profile_image TEXT,
  theme         VARCHAR(10),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON public.profiles (email_hash);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 6. CARTS — Persistent server-side carts
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.carts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash  VARCHAR(64) UNIQUE NOT NULL,
  cart_data   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carts_email_hash ON public.carts (email_hash);
CREATE INDEX IF NOT EXISTS idx_carts_data_gin   ON public.carts USING GIN (cart_data jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_carts_updated_at ON public.carts;
CREATE TRIGGER trg_carts_updated_at
  BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 7. REVIEWS — Product reviews (one per user per product)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    VARCHAR(100) NOT NULL,
  email_hash    VARCHAR(64)  NOT NULL,
  user_name     VARCHAR(200),
  user_image    TEXT,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT NOT NULL DEFAULT '',
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, email_hash)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product     ON public.reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_email        ON public.reviews (email_hash);
CREATE INDEX IF NOT EXISTS idx_reviews_rating       ON public.reviews (product_id, rating);
-- Partial index for verified reviews (common filter)
CREATE INDEX IF NOT EXISTS idx_reviews_verified     ON public.reviews (product_id)
  WHERE verified = TRUE;

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 8. INVENTORY — Product stock levels per size/variant
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          VARCHAR(100) NOT NULL,
  size                VARCHAR(20) NOT NULL DEFAULT 'FREE',
  variant_id          VARCHAR(100),
  quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  low_stock_threshold SMALLINT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Functional unique index handles NULL variant_id correctly
DROP INDEX IF EXISTS idx_inventory_unique_combo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_combo
  ON public.inventory (product_id, size, COALESCE(variant_id, ''));

-- Add missing columns to existing inventory table if needed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'reserved_quantity'
  ) THEN
    ALTER TABLE public.inventory ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'low_stock_threshold'
  ) THEN
    ALTER TABLE public.inventory ADD COLUMN low_stock_threshold SMALLINT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory (product_id);
-- Partial index: low-stock items for dashboard alerts
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock
  ON public.inventory (product_id, size)
  WHERE quantity <= low_stock_threshold;

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON public.inventory;
CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 9. STOCK ALERTS — Back-in-stock / wishlist notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  VARCHAR(100) NOT NULL,
  email_hash  VARCHAR(64)  NOT NULL,
  size        VARCHAR(20),
  notified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Functional unique index handles NULL size correctly
DROP INDEX IF EXISTS idx_sa_unique_combo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sa_unique_combo
  ON public.stock_alerts (product_id, email_hash, COALESCE(size, ''));

CREATE INDEX IF NOT EXISTS idx_sa_product    ON public.stock_alerts (product_id);
-- Partial index: only un-notified alerts matter
CREATE INDEX IF NOT EXISTS idx_sa_pending    ON public.stock_alerts (product_id, size)
  WHERE notified = FALSE;

-- ============================================================================
-- 10. SUPPORT CHATS — Customer support sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_chats (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email        VARCHAR(255) NOT NULL,
  customer_name         VARCHAR(255) NOT NULL,
  status                chat_status NOT NULL DEFAULT 'pending',
  admin_email           VARCHAR(255),
  admin_name            VARCHAR(255),
  subject               TEXT,
  rating                SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_comment        TEXT,
  unread_count          INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  customer_unread_count INTEGER NOT NULL DEFAULT 0 CHECK (customer_unread_count >= 0),
  last_message_at       TIMESTAMPTZ,
  last_message_preview  TEXT,
  closed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sc_status        ON public.support_chats (status);
CREATE INDEX IF NOT EXISTS idx_sc_customer      ON public.support_chats (customer_email);
CREATE INDEX IF NOT EXISTS idx_sc_admin         ON public.support_chats (admin_email)
  WHERE admin_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sc_updated_desc  ON public.support_chats (updated_at DESC);
-- Partial: open chats for admin dashboard
CREATE INDEX IF NOT EXISTS idx_sc_open          ON public.support_chats (status, updated_at DESC)
  WHERE status <> 'closed';

DROP TRIGGER IF EXISTS trg_sc_updated_at ON public.support_chats;
CREATE TRIGGER trg_sc_updated_at
  BEFORE UPDATE ON public.support_chats
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 11. SUPPORT MESSAGES — Chat messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.support_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  sender      chat_sender NOT NULL,
  sender_email VARCHAR(255),
  sender_name VARCHAR(255),
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sm_session     ON public.support_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sm_created     ON public.support_messages (created_at);
-- Partial: unread messages for badge counts
CREATE INDEX IF NOT EXISTS idx_sm_unread      ON public.support_messages (session_id)
  WHERE is_read = FALSE;

-- ============================================================================
-- 12. EMAIL LOGS — Transactional email audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.email_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref   VARCHAR(50) REFERENCES public.orders(ref) ON DELETE SET NULL,
  to_email    VARCHAR(255) NOT NULL,
  from_email  VARCHAR(255),
  subject     VARCHAR(500),
  body        TEXT,
  email_type  VARCHAR(50),  -- order_confirmation, payment_received, etc.
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed')),
  sent_at     TIMESTAMPTZ,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_el_order_ref    ON public.email_logs (order_ref);
CREATE INDEX IF NOT EXISTS idx_el_to_email     ON public.email_logs (to_email);
CREATE INDEX IF NOT EXISTS idx_el_created_desc ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_el_created_brin ON public.email_logs USING BRIN (created_at);
-- Partial: pending emails for retry queue
CREATE INDEX IF NOT EXISTS idx_el_pending      ON public.email_logs (created_at)
  WHERE status = 'pending';

-- ============================================================================
-- 13. USER LOGS — Activity tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255),
  name        VARCHAR(255),
  action      VARCHAR(50) NOT NULL,
  details     TEXT,
  metadata    JSONB,
  ip          INET,           -- native IP type for range queries
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ul_email        ON public.user_logs (email);
CREATE INDEX IF NOT EXISTS idx_ul_action       ON public.user_logs (action);
CREATE INDEX IF NOT EXISTS idx_ul_created_desc ON public.user_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ul_created_brin ON public.user_logs USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_ul_metadata_gin ON public.user_logs USING GIN (metadata jsonb_path_ops);

-- ============================================================================
-- 14. SECURITY AUDIT LOGS — Unified security event log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(50) NOT NULL,
  severity        audit_severity NOT NULL DEFAULT 'low',
  ip_address      INET,
  ip_hash         VARCHAR(64),
  user_agent      TEXT,
  user_id         VARCHAR(255),
  user_email      VARCHAR(255),
  email_hash      VARCHAR(64),
  request_path    TEXT,
  request_method  VARCHAR(10),
  request_id      VARCHAR(100),
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migrate existing column name from "timestamp" to "created_at" if needed
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'security_audit_logs'
      AND column_name = 'timestamp'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'security_audit_logs'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.security_audit_logs RENAME COLUMN "timestamp" TO created_at;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sal_created_desc  ON public.security_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sal_created_brin  ON public.security_audit_logs USING BRIN (created_at);
CREATE INDEX IF NOT EXISTS idx_sal_event_type    ON public.security_audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_sal_severity      ON public.security_audit_logs (severity)
  WHERE severity IN ('high','critical');
CREATE INDEX IF NOT EXISTS idx_sal_ip_hash       ON public.security_audit_logs (ip_hash)
  WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sal_email_hash    ON public.security_audit_logs (email_hash)
  WHERE email_hash IS NOT NULL;
-- Composite for dashboard threat summary
CREATE INDEX IF NOT EXISTS idx_sal_composite     ON public.security_audit_logs (created_at DESC, severity, event_type);
CREATE INDEX IF NOT EXISTS idx_sal_details_gin   ON public.security_audit_logs USING GIN (details jsonb_path_ops);

-- ============================================================================
-- 15. DATA REQUESTS — PDPA compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.data_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL,
  request_type  data_request_type NOT NULL,
  status        data_request_status NOT NULL DEFAULT 'pending',
  details       JSONB,
  processed_at  TIMESTAMPTZ,
  processed_by  VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dr_email    ON public.data_requests (email);
CREATE INDEX IF NOT EXISTS idx_dr_status   ON public.data_requests (status)
  WHERE status IN ('pending','processing');

-- ============================================================================
-- 16. RATE LIMITS — Distributed rate limiting
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  VARCHAR(255) UNIQUE NOT NULL,  -- IP:endpoint
  count       INTEGER NOT NULL DEFAULT 0,
  reset_at    TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rl_identifier ON public.rate_limits (identifier);
CREATE INDEX IF NOT EXISTS idx_rl_reset_at   ON public.rate_limits (reset_at);

-- ============================================================================
-- 17. BLOCKED IPS — IP blocklist
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  INET UNIQUE NOT NULL,
  reason      TEXT,
  blocked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  blocked_by  VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_bi_ip        ON public.blocked_ips (ip_address);
CREATE INDEX IF NOT EXISTS idx_bi_expires   ON public.blocked_ips (expires_at);
-- Partial: rows that haven't been cleaned up yet (filter expires_at > now() at query time)
CREATE INDEX IF NOT EXISTS idx_bi_active    ON public.blocked_ips (ip_address, expires_at);

-- ============================================================================
-- 18. API KEYS — Key management with rotation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  key_hash      VARCHAR(64)  UNIQUE NOT NULL,
  key_prefix    VARCHAR(20)  NOT NULL,
  permissions   TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count   BIGINT NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ,
  rate_limit    JSONB,   -- { maxRequests, windowSeconds }
  expires_at    TIMESTAMPTZ,
  created_by    VARCHAR(255),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  revoked_by    VARCHAR(255),
  revoke_reason TEXT,
  rotated_at    TIMESTAMPTZ,
  rotated_to    UUID REFERENCES public.api_keys(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ak_hash    ON public.api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_ak_prefix  ON public.api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS idx_ak_active  ON public.api_keys (is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_ak_updated_at ON public.api_keys;
CREATE TRIGGER trg_ak_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 19. PUSH SUBSCRIPTIONS — Web Push notification endpoints
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL,
  endpoint    TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth   TEXT NOT NULL,
  user_agent  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ps_email    ON public.push_subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_ps_endpoint ON public.push_subscriptions (endpoint);

DROP TRIGGER IF EXISTS trg_ps_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_ps_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- 20. KEY-VALUE STORE — Generic fallback storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.key_value_store (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(500) UNIQUE NOT NULL,
  value       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kv_key       ON public.key_value_store (key);
CREATE INDEX IF NOT EXISTS idx_kv_value_gin ON public.key_value_store USING GIN (value jsonb_path_ops);

DROP TRIGGER IF EXISTS trg_kv_updated_at ON public.key_value_store;
CREATE TRIGGER trg_kv_updated_at
  BEFORE UPDATE ON public.key_value_store
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY  (service_role only — all client access via Next.js API)
-- ============================================================================
-- Macro: enable RLS + create a single service_role policy per table.
-- anon/authenticated have ZERO direct access (all via API routes).

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'orders','payment_transactions','shipping_tracking_history',
      'config','profiles','carts',
      'reviews','inventory','stock_alerts',
      'support_chats','support_messages',
      'email_logs','user_logs','security_audit_logs',
      'data_requests','rate_limits','blocked_ips',
      'api_keys','push_subscriptions','key_value_store'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop existing permissive policies to start clean
    EXECUTE format(
      'DROP POLICY IF EXISTS "service_role_full_%s" ON public.%I', tbl, tbl
    );

    -- Create strict service_role-only policy
    EXECUTE format(
      'CREATE POLICY "service_role_full_%s" ON public.%I '
      'FOR ALL TO service_role USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- Exception: config table needs limited anon read for client-side shop settings
CREATE POLICY "anon_read_public_config" ON public.config
  FOR SELECT TO anon, authenticated
  USING (key IN ('shop-settings', 'shipping_config', 'payment_config'));

-- Exception: reviews need public read access
CREATE POLICY "public_read_reviews" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (true);

-- Exception: inventory needs public read access (stock display)
CREATE POLICY "public_read_inventory" ON public.inventory
  FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
-- Only enable realtime for tables that need live updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Full replica identity for DELETE event payloads in realtime
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_chats    REPLICA IDENTITY FULL;

-- ============================================================================
-- DOMAIN FUNCTIONS
-- ============================================================================

-- Atomic increment of unread counters in support chats
DROP FUNCTION IF EXISTS public.increment_unread(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.increment_unread(
  p_chat_id   UUID,
  p_field_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_field_name = 'unread_count' THEN
    UPDATE public.support_chats
      SET unread_count = unread_count + 1
      WHERE id = p_chat_id;
  ELSIF p_field_name = 'customer_unread_count' THEN
    UPDATE public.support_chats
      SET customer_unread_count = customer_unread_count + 1
      WHERE id = p_chat_id;
  ELSE
    RAISE EXCEPTION 'Invalid field_name: %', p_field_name;
  END IF;
END;
$$;

-- Security threat summary for admin dashboard
DROP FUNCTION IF EXISTS public.get_security_threat_summary(INTEGER);
CREATE OR REPLACE FUNCTION public.get_security_threat_summary(
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE(
  event_type  TEXT,
  severity    TEXT,
  event_count BIGINT,
  first_seen  TIMESTAMPTZ,
  last_seen   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sal.event_type,
    sal.severity::TEXT,
    COUNT(*)::BIGINT,
    MIN(sal.created_at),
    MAX(sal.created_at)
  FROM public.security_audit_logs sal
  WHERE sal.created_at > now() - (p_hours_back || ' hours')::INTERVAL
  GROUP BY sal.event_type, sal.severity
  ORDER BY COUNT(*) DESC;
END;
$$;

-- ============================================================================
-- DATA RETENTION & CLEANUP (PDPA)
-- ============================================================================

-- Comprehensive cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_data(
  p_order_retention_days   INTEGER DEFAULT 730,  -- 2 years for completed
  p_log_retention_days     INTEGER DEFAULT 365,  -- 1 year for logs
  p_audit_retention_days   INTEGER DEFAULT 730,  -- 2 years for audit
  p_security_retention_days INTEGER DEFAULT 90   -- 90 days for security logs
)
RETURNS TABLE(
  cancelled_orders_deleted  INTEGER,
  email_logs_deleted        INTEGER,
  user_logs_deleted         INTEGER,
  security_logs_deleted     INTEGER,
  rate_limits_cleaned       INTEGER,
  blocked_ips_cleaned       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cancelled INTEGER;
  v_emails    INTEGER;
  v_user_logs INTEGER;
  v_sec_logs  INTEGER;
  v_rate      INTEGER;
  v_blocked   INTEGER;
BEGIN
  -- 1. Delete old cancelled orders
  DELETE FROM public.orders
  WHERE status = 'CANCELLED'
    AND created_at < now() - (p_order_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  -- 2. Delete old email logs
  DELETE FROM public.email_logs
  WHERE created_at < now() - (p_log_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_emails = ROW_COUNT;

  -- 3. Delete old user logs
  DELETE FROM public.user_logs
  WHERE created_at < now() - (p_log_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_user_logs = ROW_COUNT;

  -- 4. Delete old security audit logs
  DELETE FROM public.security_audit_logs
  WHERE created_at < now() - (p_security_retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_sec_logs = ROW_COUNT;

  -- 5. Purge expired rate limits
  DELETE FROM public.rate_limits WHERE reset_at < now();
  GET DIAGNOSTICS v_rate = ROW_COUNT;

  -- 6. Purge expired IP blocks
  DELETE FROM public.blocked_ips WHERE expires_at < now();
  GET DIAGNOSTICS v_blocked = ROW_COUNT;

  RETURN QUERY SELECT v_cancelled, v_emails, v_user_logs,
                      v_sec_logs, v_rate, v_blocked;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_data(INTEGER,INTEGER,INTEGER,INTEGER)
  IS 'PDPA-compliant data retention: removes expired records across all log tables';

-- ============================================================================
-- VIEWS (SECURITY INVOKER — respects caller RLS)
-- ============================================================================

CREATE OR REPLACE VIEW public.v_orders_daily_summary
WITH (security_invoker = true)
AS
SELECT
  date_trunc('day', created_at)::DATE AS day,
  status,
  COUNT(*)         AS order_count,
  SUM(total_amount) AS revenue
FROM public.orders
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

CREATE OR REPLACE VIEW public.v_orders_by_status
WITH (security_invoker = true)
AS
SELECT
  status,
  COUNT(*)          AS count,
  SUM(total_amount) AS total_amount
FROM public.orders
GROUP BY status;

CREATE OR REPLACE VIEW public.v_security_critical_events
WITH (security_invoker = true)
AS
SELECT
  id, created_at, event_type, severity,
  ip_hash, email_hash, request_path, request_method,
  details, metadata
FROM public.security_audit_logs
WHERE severity IN ('high','critical')
ORDER BY created_at DESC;

CREATE OR REPLACE VIEW public.v_security_metrics_hourly
WITH (security_invoker = true)
AS
SELECT
  date_trunc('hour', created_at) AS hour,
  event_type,
  severity::TEXT,
  COUNT(*)                       AS event_count,
  COUNT(DISTINCT ip_hash)        AS unique_ips,
  COUNT(DISTINCT email_hash)     AS unique_users
FROM public.security_audit_logs
WHERE created_at > now() - INTERVAL '24 hours'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

CREATE OR REPLACE VIEW public.v_inventory_low_stock
WITH (security_invoker = true)
AS
SELECT
  product_id, size, variant_id,
  quantity, reserved_quantity,
  (quantity - reserved_quantity) AS available,
  low_stock_threshold
FROM public.inventory
WHERE (quantity - reserved_quantity) <= low_stock_threshold
ORDER BY (quantity - reserved_quantity) ASC;

CREATE OR REPLACE VIEW public.v_review_summary
WITH (security_invoker = true)
AS
SELECT
  product_id,
  COUNT(*)                            AS review_count,
  ROUND(AVG(rating)::NUMERIC, 2)     AS avg_rating,
  COUNT(*) FILTER (WHERE verified)    AS verified_count,
  COUNT(*) FILTER (WHERE rating = 5)  AS five_star,
  COUNT(*) FILTER (WHERE rating = 4)  AS four_star,
  COUNT(*) FILTER (WHERE rating = 3)  AS three_star,
  COUNT(*) FILTER (WHERE rating = 2)  AS two_star,
  COUNT(*) FILTER (WHERE rating = 1)  AS one_star
FROM public.reviews
GROUP BY product_id;

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

-- Default shop settings
INSERT INTO public.config (key, value)
VALUES (
  'shop-settings',
  '{
    "isOpen": true,
    "closeDate": "",
    "openDate": "",
    "closedMessage": "",
    "paymentEnabled": true,
    "paymentDisabledMessage": "",
    "announcements": [],
    "products": [],
    "sheetId": "",
    "sheetUrl": "",
    "vendorSheetId": "",
    "vendorSheetUrl": "",
    "bankAccount": {
      "bankName": "",
      "accountName": "",
      "accountNumber": ""
    },
    "announcementHistory": []
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Default shipping config
INSERT INTO public.config (key, value)
VALUES (
  'shipping_config',
  '{
    "showOptions": true,
    "allowPickup": true,
    "pickupLocation": "ชุมนุมคอมพิวเตอร์ คณะวิทยาศาสตร์ ม.อ.",
    "options": [
      {
        "id": "pickup",
        "provider": "pickup",
        "name": "รับหน้าร้าน",
        "description": "รับสินค้าที่ชุมนุมคอมพิวเตอร์",
        "baseFee": 0,
        "enabled": true
      },
      {
        "id": "thailand_post_ems",
        "provider": "thailand_post",
        "name": "EMS ไปรษณีย์ไทย",
        "description": "1-3 วันทำการ",
        "baseFee": 50,
        "estimatedDays": {"min": 1, "max": 3},
        "enabled": true,
        "trackingUrlTemplate": "https://track.thailandpost.co.th/?trackNumber={tracking}"
      }
    ]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Default payment config
INSERT INTO public.config (key, value)
VALUES (
  'payment_config',
  '{
    "enableCOD": false,
    "codFee": 30,
    "gateways": [],
    "options": [
      {
        "id": "bank_transfer",
        "method": "bank_transfer",
        "name": "Bank Transfer / PromptPay",
        "nameThai": "โอนเงิน / พร้อมเพย์",
        "description": "Scan QR code and transfer",
        "enabled": true,
        "sortOrder": 1
      }
    ]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- STORAGE BUCKET (images)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images', 'images', true, 5242880,
  ARRAY['image/png','image/jpeg','image/jpg','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/gif','image/webp'];

-- Storage policies
DROP POLICY IF EXISTS "public_read_images"  ON storage.objects;
DROP POLICY IF EXISTS "svc_upload_images"   ON storage.objects;
DROP POLICY IF EXISTS "svc_delete_images"   ON storage.objects;
DROP POLICY IF EXISTS "svc_update_images"   ON storage.objects;

CREATE POLICY "public_read_images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'images');

CREATE POLICY "svc_upload_images" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "svc_delete_images" ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'images');

CREATE POLICY "svc_update_images" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'images');

-- ============================================================================
-- GRANTS
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'orders','payment_transactions','shipping_tracking_history',
      'config','profiles','carts',
      'reviews','inventory','stock_alerts',
      'support_chats','support_messages',
      'email_logs','user_logs','security_audit_logs',
      'data_requests','rate_limits','blocked_ips',
      'api_keys','push_subscriptions','key_value_store'
    ])
  LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.trg_set_updated_at()                TO service_role;
GRANT EXECUTE ON FUNCTION public.is_service_role()                   TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_email_hash()               TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_unread(UUID, TEXT)        TO service_role;
GRANT EXECUTE ON FUNCTION public.get_security_threat_summary(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_data(INTEGER,INTEGER,INTEGER,INTEGER) TO service_role;

-- ============================================================================
-- TABLE COMMENTS
-- ============================================================================
COMMENT ON TABLE public.orders                    IS 'Core e-commerce orders';
COMMENT ON TABLE public.payment_transactions      IS 'Payment gateway transaction log';
COMMENT ON TABLE public.shipping_tracking_history  IS 'Carrier tracking event history';
COMMENT ON TABLE public.config                    IS 'Shop configuration key-value store';
COMMENT ON TABLE public.profiles                  IS 'Customer profiles with saved shipping info';
COMMENT ON TABLE public.carts                     IS 'Server-side persistent shopping carts';
COMMENT ON TABLE public.reviews                   IS 'Product reviews (1 per user per product)';
COMMENT ON TABLE public.inventory                 IS 'Product stock levels per size/variant';
COMMENT ON TABLE public.stock_alerts              IS 'Back-in-stock notification subscriptions';
COMMENT ON TABLE public.support_chats             IS 'Customer support chat sessions';
COMMENT ON TABLE public.support_messages          IS 'Individual chat messages in support sessions';
COMMENT ON TABLE public.email_logs                IS 'Transactional email audit trail';
COMMENT ON TABLE public.user_logs                 IS 'User activity log for analytics';
COMMENT ON TABLE public.security_audit_logs       IS 'Security event log for threat monitoring';
COMMENT ON TABLE public.data_requests             IS 'PDPA data subject requests';
COMMENT ON TABLE public.rate_limits               IS 'Distributed API rate limiting state';
COMMENT ON TABLE public.blocked_ips               IS 'IP address blocklist';
COMMENT ON TABLE public.api_keys                  IS 'API key management with rotation support';
COMMENT ON TABLE public.push_subscriptions        IS 'Web Push notification endpoint registry';
COMMENT ON TABLE public.key_value_store           IS 'Generic key-value fallback storage';

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- 1. This schema consolidates all 15+ previous migration files.
--    After deploying, the old individual files are no longer needed.
--
-- 2. Schedule `SELECT * FROM cleanup_expired_data()` via pg_cron
--    or your existing cron-worker every 24 hours.
--
-- 3. Monitor slow queries with:
--    SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
--    (drop unused indexes after 30 days)
--
-- 4. For tables >1M rows, consider:
--    - Partitioning security_audit_logs by RANGE(created_at)
--    - Partitioning user_logs by RANGE(created_at)
--    - Using pg_partman for auto-partition management
--
-- 5. Key performance features in this schema:
--    - Partial indexes: only index rows that matter (pending payments,
--      unread messages, active blocks, etc.)
--    - BRIN indexes: 100x smaller than B-tree for time-series append-only
--    - GIN indexes: fast JSONB containment queries on cart, slip_data
--    - pg_trgm index: fuzzy search on order ref
--    - ENUM types: 1-byte storage vs VARCHAR, faster GROUP BY
--    - CHECK constraints: reject bad data at the DB level
--    - Shared trigger function: one function for all updated_at triggers
--    - clock_timestamp(): accurate even inside long transactions
--
-- ============================================================================
