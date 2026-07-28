-- Atomic stock restore (mirror of deduct_stock) for reservation timeout / order cancel.
-- Run once on Supabase/Postgres. Safe to re-run (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION restore_stock(
  p_product_id TEXT,
  p_size TEXT,
  p_quantity INT
) RETURNS BOOLEAN AS $$
DECLARE
  v_updated BOOLEAN;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.inventory
  SET quantity = quantity + p_quantity,
      updated_at = NOW()
  WHERE product_id = p_product_id
    AND size = COALESCE(NULLIF(TRIM(p_size), ''), 'FREE')
  RETURNING true INTO v_updated;

  RETURN COALESCE(v_updated, false);
END;
$$ LANGUAGE plpgsql;
