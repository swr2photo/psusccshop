-- PSUSCCSHOP Phase 2 Schema Migration
-- Run this in Supabase SQL Editor

-- ==================== NOTIFICATIONS ====================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    type TEXT NOT NULL,
    channel TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    metadata JSONB,
    is_read BOOLEAN DEFAULT false NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for querying notifications by user
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- ==================== INVENTORY LOGS ====================
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    size TEXT,
    previous_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    change_type TEXT NOT NULL,
    order_ref TEXT,
    changed_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Atomic stock deduction function
CREATE OR REPLACE FUNCTION deduct_stock(
  p_product_id TEXT, 
  p_size TEXT, 
  p_quantity INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  UPDATE public.inventory
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
    AND size = COALESCE(p_size, 'FREE')
    AND quantity >= p_quantity
  RETURNING true INTO v_updated;
  
  RETURN COALESCE(v_updated, false);
END;
$$ LANGUAGE plpgsql;

-- ==================== WEBHOOKS ====================
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    shop_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status_code INT,
    response TEXT,
    attempts INT DEFAULT 0 NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON public.webhook_deliveries(endpoint_id);

-- ==================== AUDIT TRAIL ====================
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changes JSONB,
    performed_by TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON public.audit_trail(entity_type, entity_id);

-- ==================== RLS POLICIES ====================
-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Admins can do everything. Users can only view their own notifications.
CREATE POLICY "Admins full access on notifications" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Admins full access on inventory_logs" ON public.inventory_logs FOR ALL USING (true);
CREATE POLICY "Admins full access on webhook_endpoints" ON public.webhook_endpoints FOR ALL USING (true);
CREATE POLICY "Admins full access on webhook_deliveries" ON public.webhook_deliveries FOR ALL USING (true);
CREATE POLICY "Admins full access on audit_trail" ON public.audit_trail FOR ALL USING (true);
