-- Initial Schema Migration
-- Generated from src/db/schema.ts (Drizzle ORM)
-- Tables already exist on remote via drizzle-kit push; this file records
-- the baseline so Supabase migration tracking stays in sync.

-- ==================== CONFIG ====================
CREATE TABLE IF NOT EXISTS "config" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "key" text UNIQUE NOT NULL,
  "value" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== ORDERS ====================
CREATE TABLE IF NOT EXISTS "orders" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "ref" text UNIQUE NOT NULL,
  "date" text,
  "status" text DEFAULT 'WAITING_PAYMENT' NOT NULL,
  "customer_name" text NOT NULL,
  "customer_email" text NOT NULL,
  "email_hash" text NOT NULL,
  "customer_phone" text NOT NULL,
  "customer_address" text NOT NULL,
  "customer_instagram" text,
  "cart" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "total_amount" double precision DEFAULT 0 NOT NULL,
  "notes" text,
  "slip_data" jsonb,
  "payment_verified_at" text,
  "payment_method" text,
  "payment_status" text DEFAULT 'pending' NOT NULL,
  "payment_verified" boolean DEFAULT false NOT NULL,
  "payment_gateway" text,
  "shipping_option" text,
  "tracking_number" text,
  "shipping_provider" text,
  "tracking_status" text,
  "tracking_last_checked" text,
  "shipped_at" text,
  "received_at" text,
  "refund_status" text,
  "refund_reason" text,
  "refund_details" text,
  "refund_bank_name" text,
  "refund_bank_account" text,
  "refund_account_name" text,
  "refund_amount" double precision,
  "refund_requested_at" text,
  "refund_reviewed_at" text,
  "refund_reviewed_by" text,
  "refund_admin_note" text,
  "pickup_data" jsonb,
  "shop_id" text,
  "shop_slug" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== CARTS ====================
CREATE TABLE IF NOT EXISTS "carts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "email_hash" text UNIQUE NOT NULL,
  "cart_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== PROFILES ====================
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "email_hash" text UNIQUE NOT NULL,
  "name" text DEFAULT '' NOT NULL,
  "phone" text DEFAULT '' NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "instagram" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== EMAIL LOGS ====================
CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "order_ref" text,
  "to_email" text NOT NULL,
  "from_email" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "email_type" text DEFAULT 'custom' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "sent_at" text,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== USER LOGS ====================
CREATE TABLE IF NOT EXISTS "user_logs" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "email" text NOT NULL,
  "name" text,
  "action" text NOT NULL,
  "details" text,
  "metadata" jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== DATA REQUESTS (PDPA) ====================
CREATE TABLE IF NOT EXISTS "data_requests" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "email" text NOT NULL,
  "request_type" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "details" jsonb,
  "processed_at" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== KEY-VALUE STORE ====================
CREATE TABLE IF NOT EXISTS "key_value_store" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "key" text UNIQUE NOT NULL,
  "value" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== SECURITY AUDIT LOG ====================
CREATE TABLE IF NOT EXISTS "security_audit_log" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "event_type" text NOT NULL,
  "user_email" text,
  "ip_address" text,
  "user_agent" text,
  "details" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== ADMIN PERMISSIONS ====================
CREATE TABLE IF NOT EXISTS "admin_permissions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "email" text UNIQUE NOT NULL,
  "can_manage_shop" boolean DEFAULT false NOT NULL,
  "can_manage_sheet" boolean DEFAULT false NOT NULL,
  "can_manage_shipping" boolean DEFAULT false NOT NULL,
  "can_manage_payment" boolean DEFAULT false NOT NULL,
  "can_manage_products" boolean DEFAULT false NOT NULL,
  "can_manage_orders" boolean DEFAULT false NOT NULL,
  "can_manage_pickup" boolean DEFAULT false NOT NULL,
  "can_manage_tracking" boolean DEFAULT false NOT NULL,
  "can_manage_refunds" boolean DEFAULT false NOT NULL,
  "can_manage_announcement" boolean DEFAULT false NOT NULL,
  "can_manage_events" boolean DEFAULT false NOT NULL,
  "can_manage_promo_codes" boolean DEFAULT false NOT NULL,
  "can_manage_support" boolean DEFAULT false NOT NULL,
  "can_send_email" boolean DEFAULT false NOT NULL,
  "can_manage_live_stream" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== SUPPORT CHATS ====================
CREATE TABLE IF NOT EXISTS "support_chats" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "customer_email" text NOT NULL,
  "customer_name" text NOT NULL,
  "customer_avatar" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "admin_email" text,
  "admin_name" text,
  "subject" text,
  "shop_id" text,
  "shop_name" text,
  "rating" integer,
  "rating_comment" text,
  "last_message_at" timestamp,
  "last_message_preview" text,
  "unread_count" integer DEFAULT 0 NOT NULL,
  "customer_unread_count" integer DEFAULT 0 NOT NULL,
  "admin_typing" boolean DEFAULT false,
  "admin_typing_at" timestamp,
  "customer_typing" boolean DEFAULT false,
  "customer_typing_at" timestamp,
  "closed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "session_id" uuid REFERENCES "support_chats"("id") ON DELETE CASCADE NOT NULL,
  "sender" text NOT NULL,
  "sender_email" text,
  "sender_name" text,
  "sender_avatar" text,
  "message" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "read_at" timestamp,
  "is_unsent" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== SHOPS (MULTI-SHOP) ====================
CREATE TABLE IF NOT EXISTS "shops" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "slug" text UNIQUE NOT NULL,
  "name" text NOT NULL,
  "name_en" text,
  "description" text,
  "description_en" text,
  "logo_url" text,
  "banner_url" text,
  "owner_email" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "payment_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "products" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "contact_email" text,
  "contact_phone" text,
  "social_links" jsonb,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "shop_admins" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "shop_id" uuid REFERENCES "shops"("id") ON DELETE CASCADE NOT NULL,
  "email" text NOT NULL,
  "role" text DEFAULT 'admin' NOT NULL,
  "permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "added_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== PASSKEYS (WebAuthn) ====================
CREATE TABLE IF NOT EXISTS "passkey_credentials" (
  "credential_id" text PRIMARY KEY,
  "user_email" text NOT NULL,
  "public_key" text NOT NULL,
  "counter" integer DEFAULT 0 NOT NULL,
  "device_type" text NOT NULL,
  "backed_up" boolean DEFAULT false NOT NULL,
  "transports" text[],
  "friendly_name" text DEFAULT 'My Passkey' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp
);

CREATE TABLE IF NOT EXISTS "passkey_challenges" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "challenge" text NOT NULL,
  "type" text NOT NULL,
  "user_email" text,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== PUSH NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "email" text NOT NULL,
  "endpoint" text UNIQUE NOT NULL,
  "keys_p256dh" text NOT NULL,
  "keys_auth" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== RATE LIMITING ====================
CREATE TABLE IF NOT EXISTS "rate_limits" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "identifier" text UNIQUE NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "reset_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== BLOCKED IPs ====================
CREATE TABLE IF NOT EXISTS "blocked_ips" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "ip_address" text UNIQUE NOT NULL,
  "reason" text NOT NULL,
  "blocked_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);

-- ==================== INVENTORY ====================
CREATE TABLE IF NOT EXISTS "inventory" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "product_id" text NOT NULL,
  "size" text DEFAULT 'FREE' NOT NULL,
  "variant_id" text,
  "quantity" integer DEFAULT 0 NOT NULL,
  "reserved_quantity" integer DEFAULT 0 NOT NULL,
  "low_stock_threshold" integer DEFAULT 5 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== REVIEWS ====================
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "product_id" text NOT NULL,
  "email_hash" text NOT NULL,
  "user_name" text,
  "user_image" text,
  "rating" integer NOT NULL,
  "comment" text DEFAULT '' NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "helpful_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== STOCK ALERTS ====================
CREATE TABLE IF NOT EXISTS "stock_alerts" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "product_id" text NOT NULL,
  "email_hash" text NOT NULL,
  "size" text,
  "notified" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== PAYMENT TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE NOT NULL,
  "method" text NOT NULL,
  "gateway" text,
  "amount" double precision NOT NULL,
  "currency" text DEFAULT 'THB' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "gateway_transaction_id" text,
  "gateway_charge_id" text,
  "card_last4" text,
  "card_brand" text,
  "error_message" text,
  "raw_response" jsonb,
  "verified" boolean DEFAULT false NOT NULL,
  "verification_method" text,
  "verified_at" timestamp,
  "verified_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- ==================== TODOS (TEST/DEMO) ====================
CREATE TABLE IF NOT EXISTS "todos" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" text NOT NULL
);

-- ==================== RLS ====================
-- Enable RLS on all public tables
ALTER TABLE "config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "key_value_store" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_audit_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_chats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shop_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "passkey_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "passkey_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "blocked_ips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;
