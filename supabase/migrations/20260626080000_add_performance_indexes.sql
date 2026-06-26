-- =====================================================================
-- Migration: Add performance indexes for all major query patterns
-- Generated: 2026-06-26
-- 
-- IMPORTANT: All indexes use CREATE INDEX (not CONCURRENTLY) because
-- Supabase migrations run inside a transaction. For zero-downtime
-- deployment on a live production database, run each statement
-- individually with CONCURRENTLY outside a transaction.
-- =====================================================================

-- ==================== ORDERS (highest traffic table) ====================

-- Admin list: ORDER BY created_at DESC (every admin panel load)
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON orders (created_at DESC);

-- Customer lookup by email_hash (getOrdersByEmail, getJson orders/index)
CREATE INDEX IF NOT EXISTS idx_orders_email_hash
  ON orders (email_hash, created_at DESC);

-- Status filter + ordering (getAllOrders, getAllOrdersForAdminList)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at DESC);

-- Multi-shop filter (getShopOrders, shopIds filter)
CREATE INDEX IF NOT EXISTS idx_orders_shop_id
  ON orders (shop_id, created_at DESC)
  WHERE shop_id IS NOT NULL;

-- Expired unpaid orders cleanup (cron job - getExpiredUnpaidOrders)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_for_expiry
  ON orders (status, created_at)
  WHERE status IN ('PENDING', 'WAITING_PAYMENT', 'AWAITING_PAYMENT', 'UNPAID', 'DRAFT');

-- Covering index for admin list — enables index-only scan
-- Columns match ORDER_ADMIN_LIST_COLUMNS in supabase.ts
CREATE INDEX IF NOT EXISTS idx_orders_created_admin_covering
  ON orders (created_at DESC)
  INCLUDE (
    ref, status, customer_name, customer_email, customer_phone,
    total_amount, shipping_option, tracking_number,
    shop_id, shop_slug, payment_verified, date
  );


-- ==================== SUPPORT CHAT ====================

-- Messages by session (FK does NOT auto-create index in Postgres)
CREATE INDEX IF NOT EXISTS idx_support_messages_session_id
  ON support_messages (session_id, created_at);

-- Chat status filter (getPendingChats, getActiveChats, getAllChats)
CREATE INDEX IF NOT EXISTS idx_support_chats_status
  ON support_chats (status, created_at);

-- Customer email lookup — case-insensitive (getCustomerChats, getCustomerActiveChat)
CREATE INDEX IF NOT EXISTS idx_support_chats_customer_email
  ON support_chats (lower(customer_email));

-- Unread messages filter (markMessagesAsRead)
CREATE INDEX IF NOT EXISTS idx_support_messages_unread
  ON support_messages (session_id, is_read)
  WHERE is_read = false;


-- ==================== LOGS ====================

-- Email logs sorted desc (admin view - getEmailLogsFromDb)
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at
  ON email_logs (created_at DESC);

-- Email logs stats GROUP BY status (getEmailLogStats)
CREATE INDEX IF NOT EXISTS idx_email_logs_status
  ON email_logs (status);

-- User logs by email + date (getUserLogsPaginated with email filter)
CREATE INDEX IF NOT EXISTS idx_user_logs_email_created
  ON user_logs (email, created_at DESC);

-- User logs by action (getUserLogsPaginated with action filter)
CREATE INDEX IF NOT EXISTS idx_user_logs_action_created
  ON user_logs (action, created_at DESC);

-- Security audit logs sorted (getSecurityAuditLogs)
CREATE INDEX IF NOT EXISTS idx_security_audit_created
  ON security_audit_log (created_at DESC);

-- Security audit by event type
CREATE INDEX IF NOT EXISTS idx_security_audit_event
  ON security_audit_log (event_type, created_at DESC);


-- ==================== RATE LIMITING & SECURITY ====================

-- Rate limit cleanup (cleanupExpiredRateLimits)
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
  ON rate_limits (reset_at);

-- Blocked IPs active lookup (isIPBlocked)
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active
  ON blocked_ips (ip_address, expires_at);

-- Passkey credentials by user email (getCredentialsByEmail)
CREATE INDEX IF NOT EXISTS idx_passkey_creds_email
  ON passkey_credentials (user_email);

-- Passkey challenge cleanup (cleanExpiredChallenges)
CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires
  ON passkey_challenges (expires_at);


-- ==================== PRODUCTS & INVENTORY ====================

-- Inventory by product + size
CREATE INDEX IF NOT EXISTS idx_inventory_product_id
  ON inventory (product_id, size);

-- Reviews by product sorted
CREATE INDEX IF NOT EXISTS idx_reviews_product_id
  ON reviews (product_id, created_at DESC);

-- Stock alerts for un-notified alerts
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product
  ON stock_alerts (product_id, email_hash)
  WHERE notified = false;


-- ==================== SHOP ADMINS ====================

-- Shop admins by email (getShopsForAdmin, isShopAdminEmail)
CREATE INDEX IF NOT EXISTS idx_shop_admins_email
  ON shop_admins (email);


-- ==================== NOTIFICATIONS ====================

-- Notifications by recipient
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications (recipient_email, is_read, created_at DESC);


-- ==================== PAYMENT TRANSACTIONS ====================

-- Payment transactions by order (FK lookup)
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order
  ON payment_transactions (order_id);
