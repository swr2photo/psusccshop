-- Add shop_id to support_chats for per-shop chat support
-- Run this migration on your Supabase instance

ALTER TABLE support_chats ADD COLUMN IF NOT EXISTS shop_id TEXT;
ALTER TABLE support_chats ADD COLUMN IF NOT EXISTS shop_name TEXT;

-- Index for filtering chats by shop
CREATE INDEX IF NOT EXISTS idx_support_chats_shop_id ON support_chats(shop_id) WHERE shop_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN support_chats.shop_id IS 'Links chat to a specific shop (NULL = main store)';
COMMENT ON COLUMN support_chats.shop_name IS 'Shop name at time of chat creation for display';
