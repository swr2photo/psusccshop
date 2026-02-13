-- Add config JSONB column to shops table
-- This stores shop-specific configuration: announcements, events, promoCodes, liveStream, etc.
-- Run this after supabase-multi-shop-schema.sql

ALTER TABLE shops ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN shops.config IS 'Shop-local config: announcements, events, promoCodes, liveStream, pickup, shippingOptions, etc.';
