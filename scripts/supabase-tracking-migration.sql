-- PSUSCCSHOP - Add Tracking Columns Migration
-- Run this in Supabase SQL Editor to add tracking support

-- ==================== ADD TRACKING COLUMNS TO ORDERS ====================

-- Add tracking columns if they don't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS shipping_provider VARCHAR(50),
ADD COLUMN IF NOT EXISTS tracking_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS tracking_last_checked TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Add index for tracking number
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- Add index for tracking status
CREATE INDEX IF NOT EXISTS idx_orders_tracking_status ON orders(tracking_status);

-- Add composite index for tracking cron job
CREATE INDEX IF NOT EXISTS idx_orders_shipped_tracking 
ON orders(status, tracking_number) 
WHERE status = 'SHIPPED' AND tracking_number IS NOT NULL;

-- Add comments
COMMENT ON COLUMN orders.tracking_number IS 'Shipping tracking number';
COMMENT ON COLUMN orders.shipping_provider IS 'Shipping provider (thailand_post, kerry, jandt, flash, etc.)';
COMMENT ON COLUMN orders.tracking_status IS 'Last known tracking status from carrier';
COMMENT ON COLUMN orders.tracking_last_checked IS 'Last time tracking was checked';
COMMENT ON COLUMN orders.shipped_at IS 'When order was shipped';
COMMENT ON COLUMN orders.received_at IS 'When order was marked as received';

-- ==================== GRANT PERMISSIONS ====================
-- Make sure service role can access these columns
GRANT SELECT, INSERT, UPDATE ON orders TO service_role;
