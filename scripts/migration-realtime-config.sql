-- ============================================================================
-- Migration: Realtime config updates (run this in Supabase SQL Editor)
-- ============================================================================
-- Problem: the `config` table was never added to the supabase_realtime
-- publication, so postgres_changes subscriptions on it never fired and the
-- frontend never saw shop open/close or other config changes in realtime.
--
-- Design: instead of broadcasting the full shop-settings row (which is large
-- and contains unsanitized admin data), the server now bumps a tiny
-- `config-version` row on every config save. Clients subscribe to that row
-- only, then refetch the sanitized config over HTTP (/api/config).
-- ============================================================================

-- 1) Add config table to the realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.config;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Tighten anon read access on config:
--    - allow ONLY the lightweight `config-version` signal row
--    - remove direct anon access to shop-settings (it contains adminEmails,
--      sheetId, etc. — clients must use the sanitized /api/config instead)
DROP POLICY IF EXISTS "anon_read_public_config" ON public.config;
DROP POLICY IF EXISTS "Anyone can read public config" ON public.config;
DROP POLICY IF EXISTS "Anon can read config for realtime" ON public.config;

CREATE POLICY "anon_read_config_version" ON public.config
  FOR SELECT TO anon, authenticated
  USING (key = 'config-version');

-- 3) Seed the signal row so the first realtime event is an UPDATE
INSERT INTO public.config (key, value)
VALUES ('config-version', jsonb_build_object('updatedAt', now(), 'isOpen', null))
ON CONFLICT (key) DO NOTHING;
