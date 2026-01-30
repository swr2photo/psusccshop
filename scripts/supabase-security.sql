-- PSUSCCSHOP Supabase Security Policies
-- เพิ่มความปลอดภัยให้ระบบ
-- Run this in Supabase SQL Editor AFTER running supabase-schema.sql

-- ==================== DROP EXISTING POLICIES ====================
-- Orders
DROP POLICY IF EXISTS "Service role full access on orders" ON orders;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
DROP POLICY IF EXISTS "Anon can insert orders" ON orders;

-- Config
DROP POLICY IF EXISTS "Service role full access on config" ON config;
DROP POLICY IF EXISTS "Anyone can read public config" ON config;

-- Profiles
DROP POLICY IF EXISTS "Service role full access on profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Carts
DROP POLICY IF EXISTS "Service role full access on carts" ON carts;
DROP POLICY IF EXISTS "Users can manage own cart" ON carts;

-- Email logs
DROP POLICY IF EXISTS "Service role full access on email_logs" ON email_logs;

-- User logs
DROP POLICY IF EXISTS "Service role full access on user_logs" ON user_logs;

-- Data requests
DROP POLICY IF EXISTS "Service role full access on data_requests" ON data_requests;

-- Key value store
DROP POLICY IF EXISTS "Service role full access on key_value_store" ON key_value_store;

-- ==================== SERVICE ROLE POLICIES ====================
-- Service role (backend) สามารถทำได้ทุกอย่าง

CREATE POLICY "Service role full access on orders" ON orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on config" ON config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on profiles" ON profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on carts" ON carts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on email_logs" ON email_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on user_logs" ON user_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on data_requests" ON data_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on key_value_store" ON key_value_store
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== ANON/PUBLIC POLICIES ====================
-- จำกัดการเข้าถึงสำหรับ anonymous users (client-side)

-- Config: อ่านได้เฉพาะ public config
CREATE POLICY "Anyone can read public config" ON config
  FOR SELECT TO anon, authenticated
  USING (key IN ('shop-settings', 'shipping_config', 'payment_config'));

-- Orders: ไม่อนุญาต anon เข้าถึงโดยตรง (ต้องผ่าน API)
-- การจัดการ orders ทำผ่าน server-side API เท่านั้น

-- Profiles: ไม่อนุญาต anon เข้าถึงโดยตรง
-- การจัดการ profiles ทำผ่าน server-side API เท่านั้น

-- Carts: ไม่อนุญาต anon เข้าถึงโดยตรง
-- การจัดการ carts ทำผ่าน server-side API เท่านั้น

-- ==================== AUTHENTICATED USER POLICIES ====================
-- สำหรับ users ที่ login แล้ว (ถ้าใช้ Supabase Auth ในอนาคต)

-- หมายเหตุ: ปัจจุบันใช้ NextAuth จึงไม่ใช้ Supabase Auth
-- Policies เหล่านี้เตรียมไว้สำหรับอนาคต

-- CREATE POLICY "Users can view own orders" ON orders
--   FOR SELECT TO authenticated
--   USING (email_hash = encode(digest(auth.jwt() ->> 'email', 'sha256'), 'hex'));

-- CREATE POLICY "Users can view own profile" ON profiles
--   FOR SELECT TO authenticated
--   USING (email_hash = encode(digest(auth.jwt() ->> 'email', 'sha256'), 'hex'));

-- CREATE POLICY "Users can update own profile" ON profiles
--   FOR UPDATE TO authenticated
--   USING (email_hash = encode(digest(auth.jwt() ->> 'email', 'sha256'), 'hex'));

-- CREATE POLICY "Users can manage own cart" ON carts
--   FOR ALL TO authenticated
--   USING (email_hash = encode(digest(auth.jwt() ->> 'email', 'sha256'), 'hex'));

-- ==================== SECURITY FUNCTIONS ====================

-- Function to check if request is from service role
CREATE OR REPLACE FUNCTION is_service_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- Function to get current user email hash (for future use with Supabase Auth)
CREATE OR REPLACE FUNCTION get_user_email_hash()
RETURNS TEXT AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := current_setting('request.jwt.claims', true)::json->>'email';
  IF user_email IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN encode(digest(lower(trim(user_email)), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ==================== AUDIT LOG TABLE ====================
-- สำหรับบันทึก security events

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL, -- login, logout, access_denied, data_export, etc.
  user_email VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_email ON security_audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON security_audit_log(created_at DESC);

-- RLS for audit log
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on security_audit_log" ON security_audit_log;
CREATE POLICY "Service role full access on security_audit_log" ON security_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== DATA RETENTION ====================
-- Function to clean up old data (PDPA compliance)

CREATE OR REPLACE FUNCTION cleanup_old_data(retention_days INTEGER DEFAULT 365)
RETURNS TABLE(deleted_orders INTEGER, deleted_logs INTEGER, deleted_audit INTEGER) AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  orders_deleted INTEGER;
  logs_deleted INTEGER;
  audit_deleted INTEGER;
BEGIN
  cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
  
  -- Delete old cancelled orders (keep completed orders longer)
  DELETE FROM public.orders 
  WHERE status = 'CANCELLED' 
  AND created_at < cutoff_date;
  GET DIAGNOSTICS orders_deleted = ROW_COUNT;
  
  -- Delete old email logs
  DELETE FROM public.email_logs 
  WHERE created_at < cutoff_date;
  GET DIAGNOSTICS logs_deleted = ROW_COUNT;
  
  -- Delete old audit logs (keep 2 years)
  DELETE FROM public.security_audit_log 
  WHERE created_at < (NOW() - INTERVAL '730 days');
  GET DIAGNOSTICS audit_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT orders_deleted, logs_deleted, audit_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- ==================== COMMENTS ====================
COMMENT ON TABLE security_audit_log IS 'Security audit trail for compliance and monitoring';
COMMENT ON FUNCTION is_service_role() IS 'Check if current request is from service role';
COMMENT ON FUNCTION get_user_email_hash() IS 'Get SHA-256 hash of current user email';
COMMENT ON FUNCTION cleanup_old_data(INTEGER) IS 'Clean up old data for PDPA compliance';

-- ==================== SECURITY NOTES ====================
-- 
-- 1. ใช้ service_role key เฉพาะฝั่ง server เท่านั้น (ห้าม expose ใน client)
-- 2. anon key ใช้ได้ฝั่ง client แต่มีสิทธิ์จำกัด
-- 3. ทุก API routes ต้องตรวจสอบ authentication ก่อนเข้าถึงข้อมูล
-- 4. Sensitive data (slip images, phone, address) ต้อง sanitize ก่อนส่งกลับ client
-- 5. รัน cleanup_old_data() เป็นประจำเพื่อลบข้อมูลเก่า
--
-- ==================== SECURITY POLICIES COMPLETE ====================
