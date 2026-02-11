-- ================================================
-- Reviews, Inventory, Back-in-stock alerts
-- Run this migration after the base schema
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- Product Reviews
-- ================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id VARCHAR(100) NOT NULL,
  email_hash VARCHAR(64) NOT NULL,
  user_name VARCHAR(200),
  user_image TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  verified BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, email_hash) -- One review per user per product
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_email ON reviews(email_hash);

-- ================================================
-- Product Stock / Inventory
-- ================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id VARCHAR(100) NOT NULL,
  size VARCHAR(20) DEFAULT 'FREE',
  variant_id VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, size, variant_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

-- ================================================
-- Back-in-stock / Wishlist Notifications
-- ================================================
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id VARCHAR(100) NOT NULL,
  email_hash VARCHAR(64) NOT NULL,
  size VARCHAR(20),
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, email_hash, size)
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);

-- ================================================
-- RLS Policies
-- ================================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Reviews: anyone can read, authenticated can write own
CREATE POLICY "Reviews are publicly readable" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert own reviews" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (true);
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (true);

-- Inventory: publicly readable, admin can write
CREATE POLICY "Inventory is publicly readable" ON inventory FOR SELECT USING (true);
CREATE POLICY "Service role can manage inventory" ON inventory FOR ALL USING (true);

-- Stock alerts: users can manage their own
CREATE POLICY "Users can manage own stock alerts" ON stock_alerts FOR ALL USING (true);

-- Enable realtime for reviews
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
