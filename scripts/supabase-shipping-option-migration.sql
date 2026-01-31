-- PSUSCCSHOP - Add Shipping Option Column Migration
-- Run this in Supabase SQL Editor to add shipping_option column

-- ==================== ADD SHIPPING OPTION COLUMN TO ORDERS ====================

-- Add shipping_option column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipping_option VARCHAR(100);

-- Add index for shipping_option
CREATE INDEX IF NOT EXISTS idx_orders_shipping_option ON orders(shipping_option);

-- Add comment
COMMENT ON COLUMN orders.shipping_option IS 'Shipping option ID (pickup, delivery, express, etc.)';

-- ==================== GRANT PERMISSIONS ====================
GRANT SELECT, INSERT, UPDATE ON orders TO service_role;
