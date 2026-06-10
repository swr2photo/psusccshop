-- =============================================================
-- Support Chat Realtime — REMAINING STEPS ONLY
-- =============================================================
-- Run this if you already see:
--   "support_messages is already member of publication supabase_realtime"
-- That means publication is DONE — skip those lines entirely.
-- This file has NO ALTER PUBLICATION commands.
-- =============================================================

-- RLS SELECT for anon (required: browser client uses anon key for Realtime)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_chats'
      AND policyname = 'Anon can read support_chats for realtime'
  ) THEN
    CREATE POLICY "Anon can read support_chats for realtime"
      ON public.support_chats
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_messages'
      AND policyname = 'Anon can read support_messages for realtime'
  ) THEN
    CREATE POLICY "Anon can read support_messages for realtime"
      ON public.support_messages
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- Atomic unread counter helper
CREATE OR REPLACE FUNCTION public.increment_unread(chat_id UUID, field_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF field_name = 'unread_count' THEN
    UPDATE public.support_chats SET unread_count = unread_count + 1 WHERE id = chat_id;
  ELSIF field_name = 'customer_unread_count' THEN
    UPDATE public.support_chats SET customer_unread_count = customer_unread_count + 1 WHERE id = chat_id;
  ELSE
    RAISE EXCEPTION 'Invalid field_name: %', field_name;
  END IF;
END;
$$;

-- FULL replica identity (better DELETE / unsend events)
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_chats REPLICA IDENTITY FULL;

-- Quick check
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('support_messages', 'support_chats')
ORDER BY tablename;
