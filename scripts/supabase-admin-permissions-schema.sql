-- ==================== ADMIN PERMISSIONS TABLE ====================
-- เก็บสิทธิ์แอดมินแยกจาก config เพื่อให้อ่าน/เขียนเร็ว และไม่หายเวลา config ถูกเขียนทับ
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,  -- admin email (lowercase)
  
  -- ร้านค้า & ระบบ
  can_manage_shop BOOLEAN DEFAULT false,
  can_manage_sheet BOOLEAN DEFAULT false,
  can_manage_shipping BOOLEAN DEFAULT false,
  can_manage_payment BOOLEAN DEFAULT false,
  
  -- สินค้า & ออเดอร์
  can_manage_products BOOLEAN DEFAULT true,
  can_manage_orders BOOLEAN DEFAULT true,
  can_manage_pickup BOOLEAN DEFAULT false,
  can_manage_tracking BOOLEAN DEFAULT true,
  can_manage_refunds BOOLEAN DEFAULT true,
  
  -- การตลาด & สื่อสาร
  can_manage_announcement BOOLEAN DEFAULT false,
  can_manage_events BOOLEAN DEFAULT false,
  can_manage_promo_codes BOOLEAN DEFAULT false,
  can_manage_support BOOLEAN DEFAULT true,
  can_send_email BOOLEAN DEFAULT false,
  can_manage_live_stream BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_email ON admin_permissions(email);

-- ==================== RLS ====================
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON admin_permissions
  FOR ALL USING (true) WITH CHECK (true);

-- ==================== TRIGGER: auto-update updated_at ====================
CREATE OR REPLACE FUNCTION update_admin_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_permissions_updated_at
  BEFORE UPDATE ON admin_permissions
  FOR EACH ROW EXECUTE FUNCTION update_admin_permissions_updated_at();
