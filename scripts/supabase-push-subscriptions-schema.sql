-- Push Subscriptions table for Web Push Notifications
-- Run this in Supabase SQL Editor

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by email
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_email ON push_subscriptions(email);

-- Index for fast lookup by endpoint (used for upsert/delete)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- RLS policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by API routes)
CREATE POLICY "Service role can manage push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (email = current_setting('request.jwt.claim.email', true));

-- Users can delete their own subscriptions
CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions
  FOR DELETE
  USING (email = current_setting('request.jwt.claim.email', true));

-- Comment
COMMENT ON TABLE push_subscriptions IS 'Web Push notification subscriptions for users across multiple devices';
