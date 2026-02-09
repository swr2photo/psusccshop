-- =============================================================
-- Migration: Enable Supabase Realtime for Support Chat tables
-- =============================================================
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- This is REQUIRED for real-time chat to work
-- =============================================================

-- 1. Add support_messages to the realtime publication
-- Without this, Supabase will not send change events for messages
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  RAISE NOTICE 'Added support_messages to supabase_realtime publication';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'support_messages already in supabase_realtime publication';
END $$;

-- 2. Add support_chats to the realtime publication
-- Without this, Supabase will not send change events for chat sessions
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE support_chats;
  RAISE NOTICE 'Added support_chats to supabase_realtime publication';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'support_chats already in supabase_realtime publication';
END $$;

-- 3. Create RLS SELECT policy for anon role on support_chats
-- Supabase Realtime applies RLS to filter which rows to deliver.
-- The client uses the anon key, so we need a SELECT policy for anon.
-- (The channel-level filter limits what the client subscribes to.)
DO $$ BEGIN
  CREATE POLICY "Anon can read support_chats for realtime"
    ON support_chats
    FOR SELECT TO anon
    USING (true);
  RAISE NOTICE 'Created anon SELECT policy on support_chats';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Anon SELECT policy on support_chats already exists';
END $$;

-- 4. Create RLS SELECT policy for anon role on support_messages
DO $$ BEGIN
  CREATE POLICY "Anon can read support_messages for realtime"
    ON support_messages
    FOR SELECT TO anon
    USING (true);
  RAISE NOTICE 'Created anon SELECT policy on support_messages';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Anon SELECT policy on support_messages already exists';
END $$;

-- 5. Create the increment_unread RPC function for atomic unread counters
CREATE OR REPLACE FUNCTION increment_unread(chat_id UUID, field_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF field_name = 'unread_count' THEN
    UPDATE support_chats SET unread_count = unread_count + 1 WHERE id = chat_id;
  ELSIF field_name = 'customer_unread_count' THEN
    UPDATE support_chats SET customer_unread_count = customer_unread_count + 1 WHERE id = chat_id;
  ELSE
    RAISE EXCEPTION 'Invalid field_name: %', field_name;
  END IF;
END;
$$;

-- 6. Enable replica identity FULL for better DELETE event payloads
-- This allows postgres_changes DELETE events to include the old row data
ALTER TABLE support_messages REPLICA IDENTITY FULL;
ALTER TABLE support_chats REPLICA IDENTITY FULL;

-- Verify
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
