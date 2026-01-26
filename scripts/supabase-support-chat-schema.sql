-- Support Chat Tables for Supabase
-- Run this in Supabase SQL Editor

-- Support Chat Sessions Table
CREATE TABLE IF NOT EXISTS support_chats (
  id TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed')),
  admin_email TEXT,
  admin_name TEXT,
  subject TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  rating_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  customer_unread_count INTEGER NOT NULL DEFAULT 0
);

-- Support Chat Messages Table
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'admin', 'system')),
  sender_email TEXT,
  sender_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_chats_status ON support_chats(status);
CREATE INDEX IF NOT EXISTS idx_support_chats_customer_email ON support_chats(customer_email);
CREATE INDEX IF NOT EXISTS idx_support_chats_admin_email ON support_chats(admin_email);
CREATE INDEX IF NOT EXISTS idx_support_chats_created_at ON support_chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_chats_updated_at ON support_chats(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_messages_session_id ON support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_chats
-- Service role can do everything
CREATE POLICY "Service role full access on support_chats" ON support_chats
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS Policies for support_messages
-- Service role can do everything
CREATE POLICY "Service role full access on support_messages" ON support_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_support_chat_updated_at
  BEFORE UPDATE ON support_chats
  FOR EACH ROW
  EXECUTE FUNCTION update_support_chat_updated_at();

-- Grant permissions to service role
GRANT ALL ON support_chats TO service_role;
GRANT ALL ON support_messages TO service_role;
