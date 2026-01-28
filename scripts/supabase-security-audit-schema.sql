-- Security Audit Logs Table
-- สร้างตาราง security_audit_logs สำหรับเก็บ log ความปลอดภัย

-- Create table
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    ip_address TEXT,
    ip_hash TEXT,
    user_agent TEXT,
    user_id TEXT,
    user_email TEXT,
    email_hash TEXT,
    request_path TEXT,
    request_method TEXT,
    request_id TEXT,
    details JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_audit_timestamp ON security_audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip_hash ON security_audit_logs (ip_hash);
CREATE INDEX IF NOT EXISTS idx_security_audit_email_hash ON security_audit_logs (email_hash);
CREATE INDEX IF NOT EXISTS idx_security_audit_composite ON security_audit_logs (timestamp DESC, severity, event_type);

-- Enable RLS
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access (for backend only)
CREATE POLICY "Service role only" ON security_audit_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- Create function to auto-cleanup old logs
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM security_audit_logs
        WHERE timestamp < NOW() - INTERVAL '90 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_old_security_logs() TO service_role;

-- Comment on table
COMMENT ON TABLE security_audit_logs IS 'Security audit logs for tracking security events and suspicious activity';
COMMENT ON COLUMN security_audit_logs.event_type IS 'Type of security event (auth_login, access_denied, etc.)';
COMMENT ON COLUMN security_audit_logs.severity IS 'Severity level: low, medium, high, critical';
COMMENT ON COLUMN security_audit_logs.ip_hash IS 'SHA256 hash of IP address (first 16 chars)';
COMMENT ON COLUMN security_audit_logs.email_hash IS 'SHA256 hash of email address (first 16 chars)';
