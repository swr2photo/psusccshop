-- Fix Security Definer Views
-- แก้ไข views ที่มี SECURITY DEFINER ให้เป็น SECURITY INVOKER
-- ตามคำแนะนำของ Supabase Linter

-- ==================== DROP AND RECREATE VIEWS ====================

-- 1. Fix security_critical_events view
DROP VIEW IF EXISTS public.security_critical_events;
CREATE OR REPLACE VIEW public.security_critical_events
WITH (security_invoker = true)
AS
SELECT 
    id,
    timestamp,
    event_type,
    severity,
    ip_hash,
    email_hash,
    request_path,
    request_method,
    details,
    metadata
FROM public.security_audit_logs
WHERE severity IN ('high', 'critical')
ORDER BY timestamp DESC;

-- Grant access
GRANT SELECT ON public.security_critical_events TO service_role;

-- 2. Fix security_metrics_hourly view
DROP VIEW IF EXISTS public.security_metrics_hourly;
CREATE OR REPLACE VIEW public.security_metrics_hourly
WITH (security_invoker = true)
AS
SELECT 
    date_trunc('hour', timestamp) AS hour,
    event_type,
    severity,
    COUNT(*) AS event_count,
    COUNT(DISTINCT ip_hash) AS unique_ips,
    COUNT(DISTINCT email_hash) AS unique_users
FROM public.security_audit_logs
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY date_trunc('hour', timestamp), event_type, severity
ORDER BY hour DESC, event_count DESC;

-- Grant access
GRANT SELECT ON public.security_metrics_hourly TO service_role;

-- 3. Fix security_ip_analysis view
DROP VIEW IF EXISTS public.security_ip_analysis;
CREATE OR REPLACE VIEW public.security_ip_analysis
WITH (security_invoker = true)
AS
SELECT 
    ip_hash,
    COUNT(*) AS total_requests,
    COUNT(DISTINCT event_type) AS unique_event_types,
    COUNT(*) FILTER (WHERE severity = 'critical') AS critical_events,
    COUNT(*) FILTER (WHERE severity = 'high') AS high_events,
    MIN(timestamp) AS first_seen,
    MAX(timestamp) AS last_seen
FROM public.security_audit_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY ip_hash
HAVING COUNT(*) > 10
ORDER BY critical_events DESC, high_events DESC, total_requests DESC;

-- Grant access
GRANT SELECT ON public.security_ip_analysis TO service_role;

-- ==================== VERIFY ====================
-- รันคำสั่งนี้เพื่อตรวจสอบว่าไม่มี SECURITY DEFINER views เหลืออยู่:
--
-- SELECT schemaname, viewname, definition 
-- FROM pg_views 
-- WHERE schemaname = 'public' 
-- AND viewname IN ('security_critical_events', 'security_metrics_hourly', 'security_ip_analysis');
--
-- หรือเช็คใน Supabase Dashboard > Database > Linter

-- ==================== NOTE ====================
-- ถ้า views เหล่านี้ไม่มีอยู่จริง ให้ลบบรรทัด DROP VIEW ออก
-- และเปลี่ยนเป็น CREATE VIEW แทน CREATE OR REPLACE VIEW
