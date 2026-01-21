-- PSUSCCSHOP Supabase Migration Script
-- สร้าง tables สำหรับ E-Commerce Shop
-- Run this in Supabase SQL Editor

-- ==================== EXTENSIONS ====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== DROP EXISTING TABLES (if migrating) ====================
-- Uncomment these lines if you need to reset the database
-- DROP TABLE IF EXISTS data_requests CASCADE;
-- DROP TABLE IF EXISTS user_logs CASCADE;
-- DROP TABLE IF EXISTS email_logs CASCADE;
-- DROP TABLE IF EXISTS carts CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS config CASCADE;
-- DROP TABLE IF EXISTS key_value_store CASCADE;

-- ==================== ORDERS TABLE ====================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref VARCHAR(50) UNIQUE NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'WAITING_PAYMENT',
  
  -- Customer info
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  email_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for indexing
  customer_phone VARCHAR(50),
  customer_address TEXT,
  customer_instagram VARCHAR(100),
  
  -- Order details
  cart JSONB DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  
  -- Payment info
  slip_data JSONB, -- Contains base64, verified status, etc.
  payment_verified_at TIMESTAMPTZ,
  payment_method VARCHAR(50),
  
  -- Pickup info
  pickup_status VARCHAR(50), -- PENDING, READY, PICKED_UP
  pickup_at TIMESTAMPTZ,
  pickup_by VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_email_hash ON orders(email_hash);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(ref);

-- ==================== CONFIG TABLE ====================
CREATE TABLE IF NOT EXISTS config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);

-- ==================== PROFILES TABLE ====================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash
  name VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  instagram VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email_hash ON profiles(email_hash);

-- ==================== CARTS TABLE ====================
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash
  cart_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_email_hash ON carts(email_hash);

-- ==================== EMAIL LOGS TABLE ====================
CREATE TABLE IF NOT EXISTS email_logs (
  id VARCHAR(100) PRIMARY KEY,
  order_ref VARCHAR(50) REFERENCES orders(ref) ON DELETE SET NULL,
  to_email VARCHAR(255) NOT NULL,
  from_email VARCHAR(255),
  subject VARCHAR(500),
  body TEXT,
  email_type VARCHAR(50), -- order_confirmation, payment_received, etc.
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_order_ref ON email_logs(order_ref);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);

-- ==================== USER LOGS TABLE ====================
CREATE TABLE IF NOT EXISTS user_logs (
  id VARCHAR(100) PRIMARY KEY,
  email VARCHAR(255),
  name VARCHAR(255),
  action VARCHAR(50) NOT NULL, -- login, logout, view_product, add_to_cart, etc.
  details TEXT,
  metadata JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_logs_email ON user_logs(email);
CREATE INDEX IF NOT EXISTS idx_user_logs_action ON user_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON user_logs(created_at DESC);

-- ==================== DATA REQUESTS TABLE (PDPA) ====================
CREATE TABLE IF NOT EXISTS data_requests (
  id VARCHAR(100) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL, -- access, download, delete, rectification
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, rejected
  details JSONB,
  processed_at TIMESTAMPTZ,
  processed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_email ON data_requests(email);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(status);

-- ==================== KEY-VALUE STORE (FALLBACK) ====================
CREATE TABLE IF NOT EXISTS key_value_store (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(500) UNIQUE NOT NULL,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kv_key ON key_value_store(key);

-- ==================== FUNCTIONS ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Apply triggers
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_config_updated_at ON config;
CREATE TRIGGER update_config_updated_at
  BEFORE UPDATE ON config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carts_updated_at ON carts;
CREATE TRIGGER update_carts_updated_at
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kv_updated_at ON key_value_store;
CREATE TRIGGER update_kv_updated_at
  BEFORE UPDATE ON key_value_store
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== ROW LEVEL SECURITY (RLS) ====================

-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_value_store ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to allow re-running this script)
DROP POLICY IF EXISTS "Service role full access on orders" ON orders;
DROP POLICY IF EXISTS "Service role full access on config" ON config;
DROP POLICY IF EXISTS "Service role full access on profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access on carts" ON carts;
DROP POLICY IF EXISTS "Service role full access on email_logs" ON email_logs;
DROP POLICY IF EXISTS "Service role full access on user_logs" ON user_logs;
DROP POLICY IF EXISTS "Service role full access on data_requests" ON data_requests;
DROP POLICY IF EXISTS "Service role full access on key_value_store" ON key_value_store;

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access on orders" ON orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on config" ON config
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on profiles" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on carts" ON carts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on email_logs" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on user_logs" ON user_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on data_requests" ON data_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on key_value_store" ON key_value_store
  FOR ALL USING (auth.role() = 'service_role');

-- ==================== INITIAL DATA ====================

-- Insert default shop config if not exists
INSERT INTO config (key, value) 
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

-- ==================== USEFUL VIEWS ====================

-- Orders summary view (uses invoker's permissions for RLS compliance)
CREATE OR REPLACE VIEW orders_summary 
WITH (security_invoker = on) AS
SELECT 
  date_trunc('day', created_at) as date,
  status,
  COUNT(*) as order_count,
  SUM(total_amount) as total_revenue
FROM orders
GROUP BY date_trunc('day', created_at), status
ORDER BY date DESC;

-- Orders by status view (uses invoker's permissions for RLS compliance)
CREATE OR REPLACE VIEW orders_by_status 
WITH (security_invoker = on) AS
SELECT 
  status,
  COUNT(*) as count,
  SUM(total_amount) as total_amount
FROM orders
GROUP BY status;

-- ==================== COMMENTS ====================
COMMENT ON TABLE orders IS 'Main orders table - stores all customer orders';
COMMENT ON TABLE config IS 'Shop configuration storage - key/value pairs for settings';
COMMENT ON TABLE profiles IS 'Customer profiles - stores saved shipping info';
COMMENT ON TABLE carts IS 'Saved shopping carts - persisted across sessions';
COMMENT ON TABLE email_logs IS 'Email sending history for audit and debugging';
COMMENT ON TABLE user_logs IS 'User activity logs for analytics and security';
COMMENT ON TABLE data_requests IS 'PDPA data subject requests tracking';
COMMENT ON TABLE key_value_store IS 'Generic key-value storage for misc data';

COMMENT ON COLUMN orders.email_hash IS 'SHA-256 hash of customer email for privacy-preserving indexing';
COMMENT ON COLUMN orders.slip_data IS 'Payment slip data including base64 image and verification status';
COMMENT ON COLUMN profiles.email_hash IS 'SHA-256 hash of customer email - never store raw email in this table';

-- ==================== MIGRATION COMPLETE ====================
-- Run this script in Supabase SQL Editor to set up all tables
-- After running, update your .env.local with:
-- NEXT_PUBLIC_SUPABASE_URL=your-project-url
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
-- SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

-- ==================== REALTIME SETUP ====================
-- Enable Realtime for specific tables
-- This allows client-side subscriptions to listen for changes

-- Enable realtime for orders table (for order status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

-- Enable realtime for config table (for shop settings changes)
ALTER PUBLICATION supabase_realtime ADD TABLE config;

-- ==================== REALTIME RLS POLICIES ====================
-- Allow anonymous users to receive realtime updates

-- Orders: Allow reading own orders via email_hash (for realtime subscription)
DROP POLICY IF EXISTS "Anon can read own orders for realtime" ON orders;
CREATE POLICY "Anon can read own orders for realtime" ON orders
  FOR SELECT 
  TO anon
  USING (true); -- Note: Filter happens in channel subscription, not RLS

-- Config: Allow reading config for realtime (public shop settings)
DROP POLICY IF EXISTS "Anon can read config for realtime" ON config;
CREATE POLICY "Anon can read config for realtime" ON config
  FOR SELECT 
  TO anon
  USING (key = 'shop-settings'); -- Only allow reading shop settings

-- Note: For more secure realtime, you can use custom JWT claims
-- and filter based on the user's email_hash in the policy

