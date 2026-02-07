-- ==========================================
-- Refund Request System - Supabase Migration
-- ==========================================

-- Add refund-related columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reason TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_details TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_bank_name VARCHAR(100) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_bank_account VARCHAR(50) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_account_name VARCHAR(255) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reviewed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_reviewed_by VARCHAR(255) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_admin_note TEXT DEFAULT NULL;

-- refund_status values:
--   NULL = no refund request
--   'REQUESTED' = user submitted refund request
--   'APPROVED' = admin approved, pending refund
--   'COMPLETED' = refund has been processed
--   'REJECTED' = admin rejected the request

-- Create index for refund status lookups
CREATE INDEX IF NOT EXISTS idx_orders_refund_status ON orders(refund_status) WHERE refund_status IS NOT NULL;

-- Enable realtime for refund updates (already enabled for orders table, just confirm)
-- ALTER PUBLICATION supabase_realtime ADD TABLE orders;

COMMENT ON COLUMN orders.refund_status IS 'Refund request status: REQUESTED, APPROVED, COMPLETED, REJECTED';
COMMENT ON COLUMN orders.refund_reason IS 'Reason for refund request from customer';
COMMENT ON COLUMN orders.refund_details IS 'Additional details for refund request';
COMMENT ON COLUMN orders.refund_bank_name IS 'Customer bank name for refund transfer';
COMMENT ON COLUMN orders.refund_bank_account IS 'Customer bank account number for refund';
COMMENT ON COLUMN orders.refund_account_name IS 'Customer bank account holder name';
COMMENT ON COLUMN orders.refund_amount IS 'Amount to refund (may be partial)';
COMMENT ON COLUMN orders.refund_requested_at IS 'Timestamp when refund was requested';
COMMENT ON COLUMN orders.refund_reviewed_at IS 'Timestamp when admin reviewed the request';
COMMENT ON COLUMN orders.refund_reviewed_by IS 'Admin email who reviewed the request';
COMMENT ON COLUMN orders.refund_admin_note IS 'Admin note/reason for approval or rejection';
