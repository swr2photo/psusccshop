-- Passkey (WebAuthn) credentials storage
-- Run this migration on your Supabase instance

-- Store registered passkey credentials
CREATE TABLE IF NOT EXISTS passkey_credentials (
  credential_id TEXT PRIMARY KEY,             -- base64url-encoded credential ID
  user_email TEXT NOT NULL,                    -- owner email
  public_key TEXT NOT NULL,                    -- base64url-encoded public key
  counter BIGINT NOT NULL DEFAULT 0,           -- signature counter for clone detection
  device_type TEXT DEFAULT 'singleDevice',     -- 'singleDevice' | 'multiDevice'
  backed_up BOOLEAN DEFAULT false,             -- synced to cloud (e.g. iCloud Keychain)
  transports TEXT[] DEFAULT '{}',              -- 'usb','ble','nfc','internal','hybrid'
  friendly_name TEXT DEFAULT 'Passkey',        -- user-assigned name
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_email
  ON passkey_credentials(user_email);

COMMENT ON TABLE passkey_credentials IS 'WebAuthn/Passkey credentials for passwordless sign-in';

-- Ephemeral challenges for registration & authentication
CREATE TABLE IF NOT EXISTS passkey_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge TEXT NOT NULL,                     -- base64url challenge string
  user_email TEXT,                             -- NULL for discoverable login
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_passkey_challenges_expires
  ON passkey_challenges(expires_at);

-- Auto-clean expired challenges (run periodically or use pg_cron)
-- SELECT cron.schedule('clean-passkey-challenges', '*/10 * * * *',
--   $$DELETE FROM passkey_challenges WHERE expires_at < now()$$);

-- RLS policies
ALTER TABLE passkey_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (API routes use service role)
CREATE POLICY "Service role full access on passkey_credentials"
  ON passkey_credentials FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on passkey_challenges"
  ON passkey_challenges FOR ALL
  USING (true) WITH CHECK (true);
