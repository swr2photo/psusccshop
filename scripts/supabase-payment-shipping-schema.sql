-- Supabase SQL Schema for Payment and Shipping Features
-- Run this in Supabase SQL Editor

-- =========================================
-- PAYMENT TRANSACTIONS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  method TEXT NOT NULL,
  gateway TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'THB',
  status TEXT NOT NULL DEFAULT 'pending',
  gateway_transaction_id TEXT,
  gateway_charge_id TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  error_message TEXT,
  raw_response JSONB,
  verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_charge_id ON payment_transactions(gateway_charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- =========================================
-- UPDATE ORDERS TABLE (ADD SHIPPING/PAYMENT FIELDS)
-- =========================================
-- Add shipping fields if not exist
DO $$ 
BEGIN
  -- Shipping provider
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_provider') THEN
    ALTER TABLE orders ADD COLUMN shipping_provider TEXT;
  END IF;
  
  -- Shipping option ID
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_option_id') THEN
    ALTER TABLE orders ADD COLUMN shipping_option_id TEXT;
  END IF;
  
  -- Tracking number
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_number TEXT;
  END IF;
  
  -- Tracking URL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_url') THEN
    ALTER TABLE orders ADD COLUMN tracking_url TEXT;
  END IF;
  
  -- Shipping status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_status') THEN
    ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'pending';
  END IF;
  
  -- Shipped at timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipped_at') THEN
    ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;
  END IF;
  
  -- Delivered at timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivered_at') THEN
    ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;
  
  -- Payment method
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'bank_transfer';
  END IF;
  
  -- Payment gateway
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_gateway') THEN
    ALTER TABLE orders ADD COLUMN payment_gateway TEXT;
  END IF;
  
  -- Payment status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
    ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
  END IF;
  
  -- Payment verified
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_verified') THEN
    ALTER TABLE orders ADD COLUMN payment_verified BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Payment verified at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_verified_at') THEN
    ALTER TABLE orders ADD COLUMN payment_verified_at TIMESTAMPTZ;
  END IF;
END $$;

-- =========================================
-- CONFIG TABLE (IF NOT EXISTS)
-- =========================================
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================
-- SHIPPING TRACKING HISTORY TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS shipping_tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  status_text TEXT,
  location TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shipping_tracking_history
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_order_id ON shipping_tracking_history(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_number ON shipping_tracking_history(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_timestamp ON shipping_tracking_history(timestamp DESC);

-- =========================================
-- ROW LEVEL SECURITY (RLS)
-- =========================================
-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_tracking_history ENABLE ROW LEVEL SECURITY;

-- Policies for payment_transactions
-- Admins can see all, users can only see their own
CREATE POLICY "Allow all for service role" ON payment_transactions
  FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- Policies for shipping_tracking_history
CREATE POLICY "Allow all for service role" ON shipping_tracking_history
  FOR ALL 
  TO service_role 
  USING (true)
  WITH CHECK (true);

-- =========================================
-- FUNCTIONS
-- =========================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_config_updated_at ON config;
CREATE TRIGGER update_config_updated_at
    BEFORE UPDATE ON config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- SAMPLE INITIAL CONFIG DATA
-- =========================================
-- Insert default shipping config if not exists
INSERT INTO config (key, value) 
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

-- Insert default payment config if not exists
INSERT INTO config (key, value)
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

-- =========================================
-- GRANT PERMISSIONS
-- =========================================
GRANT ALL ON payment_transactions TO service_role;
GRANT ALL ON shipping_tracking_history TO service_role;
GRANT ALL ON config TO service_role;

-- Success message
SELECT 'Payment and Shipping schema created successfully!' AS status;
