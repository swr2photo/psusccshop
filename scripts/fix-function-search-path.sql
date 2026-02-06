-- Fix Function Search Path Mutable
-- แก้ไข functions ที่ไม่ได้ตั้งค่า search_path
-- ตามคำแนะนำของ Supabase Linter

-- ==================== FIX FUNCTIONS ====================

-- 1. Fix update_support_chat_updated_at
CREATE OR REPLACE FUNCTION public.update_support_chat_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 2. Fix cleanup_old_security_logs
DROP FUNCTION IF EXISTS public.cleanup_old_security_logs();
CREATE FUNCTION public.cleanup_old_security_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM public.security_audit_logs
        WHERE timestamp < NOW() - INTERVAL '90 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$;

-- 3. Fix get_security_threat_summary
DROP FUNCTION IF EXISTS public.get_security_threat_summary(INTEGER);
CREATE OR REPLACE FUNCTION public.get_security_threat_summary(hours_back INTEGER DEFAULT 24)
RETURNS TABLE(
    event_type TEXT,
    severity TEXT,
    count BIGINT,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sal.event_type,
        sal.severity,
        COUNT(*)::BIGINT as count,
        MIN(sal.timestamp) as first_seen,
        MAX(sal.timestamp) as last_seen
    FROM public.security_audit_logs sal
    WHERE sal.timestamp > NOW() - (hours_back || ' hours')::INTERVAL
    GROUP BY sal.event_type, sal.severity
    ORDER BY count DESC;
END;
$$;

-- 4. Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 5. Fix is_service_role
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
END;
$$;

-- 6. Fix get_user_email_hash
CREATE OR REPLACE FUNCTION public.get_user_email_hash()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_email TEXT;
BEGIN
    user_email := current_setting('request.jwt.claims', true)::json->>'email';
    IF user_email IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(digest(lower(trim(user_email)), 'sha256'), 'hex');
END;
$$;

-- 7. Fix cleanup_old_data
CREATE OR REPLACE FUNCTION public.cleanup_old_data(retention_days INTEGER DEFAULT 365)
RETURNS TABLE(deleted_orders INTEGER, deleted_logs INTEGER, deleted_audit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    cutoff_date TIMESTAMPTZ;
    orders_deleted INTEGER;
    logs_deleted INTEGER;
    audit_deleted INTEGER;
BEGIN
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
    
    -- Delete old cancelled orders (keep completed orders longer)
    DELETE FROM public.orders 
    WHERE status = 'CANCELLED' 
    AND created_at < cutoff_date;
    GET DIAGNOSTICS orders_deleted = ROW_COUNT;
    
    -- Delete old email logs
    DELETE FROM public.email_logs 
    WHERE created_at < cutoff_date;
    GET DIAGNOSTICS logs_deleted = ROW_COUNT;
    
    -- Delete old audit logs (keep 2 years)
    DELETE FROM public.security_audit_log 
    WHERE created_at < (NOW() - INTERVAL '730 days');
    GET DIAGNOSTICS audit_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT orders_deleted, logs_deleted, audit_deleted;
END;
$$;

-- ==================== VERIFY ====================
-- รันคำสั่งนี้เพื่อตรวจสอบว่า functions มี search_path แล้ว:
--
-- SELECT 
--     proname as function_name,
--     proconfig as config
-- FROM pg_proc 
-- WHERE pronamespace = 'public'::regnamespace
-- AND proname IN (
--     'update_support_chat_updated_at',
--     'cleanup_old_security_logs', 
--     'get_security_threat_summary',
--     'update_updated_at_column',
--     'is_service_role',
--     'get_user_email_hash',
--     'cleanup_old_data'
-- );
--
-- ควรเห็น config มีค่า {search_path=} หรือ {search_path=""} สำหรับทุก function

-- ==================== GRANT PERMISSIONS ====================
GRANT EXECUTE ON FUNCTION public.cleanup_old_security_logs() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_security_threat_summary(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_email_hash() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_data(INTEGER) TO service_role;
