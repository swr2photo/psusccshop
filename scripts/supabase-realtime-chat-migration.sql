-- =============================================================
-- Migration: Enable Supabase Realtime for Support Chat tables
-- =============================================================
-- FIRST TIME ONLY: run this entire file once on a fresh database.
--
-- If publication already exists and you get error 42710
-- "already member of publication" → publication is DONE.
-- Run instead: supabase-realtime-chat-migration-remaining.sql
-- Verify with: supabase-realtime-chat-verify.sql
-- =============================================================

-- ── SKIP if support_messages / support_chats already in publication ──
-- Dashboard → Database → Publications → supabase_realtime should list both tables.
-- Do NOT re-run ALTER PUBLICATION below if they are already listed.

-- 3. RLS SELECT policy for anon on support_chats
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
    RAISE NOTICE 'Created anon SELECT policy on support_chats';
  ELSE
    RAISE NOTICE 'Anon SELECT policy on support_chats already exists (OK)';
  END IF;
END $$;

-- 4. RLS SELECT policy for anon on support_messages
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
    RAISE NOTICE 'Created anon SELECT policy on support_messages';
  ELSE
    RAISE NOTICE 'Anon SELECT policy on support_messages already exists (OK)';
  END IF;
END $$;

-- 5. increment_unread RPC
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

-- 6. Replica identity FULL
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER TABLE public.support_chats REPLICA IDENTITY FULL;

-- Verify
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
