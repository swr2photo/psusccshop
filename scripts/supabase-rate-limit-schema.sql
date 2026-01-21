-- Additional tables for Rate Limiting, API Keys, and IP Blocking
-- Run this after supabase-security.sql

-- ==================== RATE LIMITS TABLE ====================
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL UNIQUE, -- IP:endpoint pattern
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access
DROP POLICY IF EXISTS "Service role full access on rate_limits" ON rate_limits;
CREATE POLICY "Service role full access on rate_limits" ON rate_limits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== BLOCKED IPS TABLE ====================
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address VARCHAR(45) NOT NULL UNIQUE, -- IPv6 max length
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  blocked_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires ON blocked_ips(expires_at);

-- Enable RLS
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

-- Only service role can access
DROP POLICY IF EXISTS "Service role full access on blocked_ips" ON blocked_ips;
CREATE POLICY "Service role full access on blocked_ips" ON blocked_ips
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== API KEYS TABLE ====================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash
  key_prefix VARCHAR(20) NOT NULL, -- First 12 chars for identification
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by VARCHAR(255),
  revoked_at TIMESTAMPTZ,
  revoked_by VARCHAR(255),
  revoke_reason TEXT,
  rotated_at TIMESTAMPTZ,
  rotated_to UUID REFERENCES api_keys(id),
  rate_limit JSONB -- { maxRequests: number, windowSeconds: number }
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access
DROP POLICY IF EXISTS "Service role full access on api_keys" ON api_keys;
CREATE POLICY "Service role full access on api_keys" ON api_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUTO UPDATE TIMESTAMP ====================
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS api_keys_updated_at ON api_keys;
CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_api_keys_updated_at();

-- ==================== CLEANUP FUNCTION ====================
-- Function to clean up expired rate limits and blocked IPs
CREATE OR REPLACE FUNCTION cleanup_rate_limiting()
RETURNS TABLE(deleted_rate_limits INTEGER, deleted_blocked_ips INTEGER) AS $$
DECLARE
  rate_limits_deleted INTEGER;
  blocked_ips_deleted INTEGER;
BEGIN
  -- Delete expired rate limits
  DELETE FROM rate_limits WHERE reset_at < NOW();
  GET DIAGNOSTICS rate_limits_deleted = ROW_COUNT;
  
  -- Delete expired IP blocks
  DELETE FROM blocked_ips WHERE expires_at < NOW();
  GET DIAGNOSTICS blocked_ips_deleted = ROW_COUNT;
  
  RETURN QUERY SELECT rate_limits_deleted, blocked_ips_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== COMMENTS ====================
COMMENT ON TABLE rate_limits IS 'Distributed rate limiting storage';
COMMENT ON TABLE blocked_ips IS 'Blocked IP addresses';
COMMENT ON TABLE api_keys IS 'API key management with rotation support';
COMMENT ON FUNCTION cleanup_rate_limiting() IS 'Clean up expired rate limits and IP blocks';

-- ==================== INITIAL CRON API KEY ====================
-- สร้าง cron key สำหรับ Vercel Cron (optional)
-- INSERT INTO api_keys (name, key_hash, key_prefix, permissions, created_by)
-- VALUES ('Vercel Cron', '<hash-of-your-cron-secret>', 'psu_cron_', ARRAY['cron:run'], 'SYSTEM');
