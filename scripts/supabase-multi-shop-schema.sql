-- =====================================================
-- Multi-Shop Schema Migration
-- =====================================================
-- Adds shops, shop_admins tables and shop_id to orders
-- Run this in Supabase SQL Editor
-- =====================================================

-- ==================== ENUMS ====================
DO $$ BEGIN
  CREATE TYPE shop_admin_role AS ENUM ('owner', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== SHOPS TABLE ====================
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description TEXT,
  description_en TEXT,
  logo_url TEXT,
  banner_url TEXT,
  owner_email VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  -- Shop-specific settings
  settings JSONB DEFAULT '{
    "isOpen": true,
    "closeDate": "",
    "closedMessage": "",
    "paymentEnabled": true
  }'::jsonb,
  -- Payment info per shop
  payment_info JSONB DEFAULT '{
    "promptPayId": "",
    "bankName": "",
    "accountName": "",
    "accountNumber": ""
  }'::jsonb,
  -- Products stored as JSONB array (same structure as ShopConfig.products)
  products JSONB DEFAULT '[]'::jsonb,
  -- Contact & social
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  social_links JSONB DEFAULT '{}'::jsonb,
  -- Metadata
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_shops_owner ON shops(owner_email);
CREATE INDEX IF NOT EXISTS idx_shops_active ON shops(is_active) WHERE is_active = true;

-- ==================== SHOP ADMINS TABLE ====================
CREATE TABLE IF NOT EXISTS shop_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role shop_admin_role DEFAULT 'admin',
  -- Granular permissions (same keys as AdminPermissions)
  permissions JSONB DEFAULT '{
    "canManageProducts": true,
    "canManageOrders": true,
    "canManagePickup": false,
    "canManageTracking": true,
    "canManageRefunds": true,
    "canManageAnnouncement": false,
    "canManageEvents": false,
    "canManageSupport": true,
    "canManageShop": false,
    "canManagePayment": false,
    "canManageShipping": false,
    "canAddAdmins": false
  }'::jsonb,
  added_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, email)
);

CREATE INDEX IF NOT EXISTS idx_shop_admins_email ON shop_admins(email);
CREATE INDEX IF NOT EXISTS idx_shop_admins_shop ON shop_admins(shop_id);

-- ==================== ADD shop_id TO ORDERS ====================
-- Add column if not exists
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN shop_id UUID REFERENCES shops(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add shop_slug for quick filtering without joins
DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN shop_slug VARCHAR(100);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_slug ON orders(shop_slug);

-- ==================== RLS POLICIES ====================
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_admins ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DROP POLICY IF EXISTS shops_service_role ON shops;
CREATE POLICY shops_service_role ON shops FOR ALL
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS shop_admins_service_role ON shop_admins;
CREATE POLICY shop_admins_service_role ON shop_admins FOR ALL
  USING (true) WITH CHECK (true);

-- Anon can read active shops (for storefront)
DROP POLICY IF EXISTS shops_anon_read ON shops;
CREATE POLICY shops_anon_read ON shops FOR SELECT
  USING (is_active = true);

-- ==================== UPDATED_AT TRIGGERS ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shops_updated_at ON shops;
CREATE TRIGGER shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS shop_admins_updated_at ON shop_admins;
CREATE TRIGGER shop_admins_updated_at
  BEFORE UPDATE ON shop_admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== HELPER FUNCTIONS ====================

-- Get all shops for a given admin email (includes shops they own or admin)
CREATE OR REPLACE FUNCTION get_shops_for_admin(admin_email TEXT)
RETURNS TABLE (
  shop_id UUID,
  shop_slug VARCHAR,
  shop_name VARCHAR,
  admin_role shop_admin_role,
  permissions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.slug, s.name, sa.role, sa.permissions
  FROM shops s
  INNER JOIN shop_admins sa ON sa.shop_id = s.id
  WHERE sa.email = lower(trim(admin_email))
    AND s.is_active = true
  ORDER BY s.sort_order, s.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get shop with product count
CREATE OR REPLACE FUNCTION get_shop_summary(shop_slug_param TEXT)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  name VARCHAR,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN,
  product_count BIGINT,
  admin_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id, s.slug, s.name, s.description, s.logo_url, s.is_active,
    COALESCE(jsonb_array_length(s.products), 0)::BIGINT as product_count,
    (SELECT COUNT(*) FROM shop_admins sa WHERE sa.shop_id = s.id)::BIGINT as admin_count
  FROM shops s
  WHERE s.slug = shop_slug_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
