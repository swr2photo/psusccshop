-- Verify support-chat Realtime setup (read-only checks)
-- Run in Supabase Dashboard → SQL Editor

-- 1) Tables in realtime publication
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('support_messages', 'support_chats')
ORDER BY tablename;

-- 2) RLS enabled
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('support_messages', 'support_chats');

-- 3) Anon SELECT policies (required for client Realtime with anon key)
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('support_messages', 'support_chats')
  AND 'anon' = ANY(roles)
ORDER BY tablename, policyname;

-- 4) Replica identity (FULL helps DELETE/unsend events)
SELECT c.relname AS table_name,
       CASE c.relreplident
         WHEN 'd' THEN 'DEFAULT'
         WHEN 'n' THEN 'NOTHING'
         WHEN 'f' THEN 'FULL'
         WHEN 'i' THEN 'INDEX'
       END AS replica_identity
FROM pg_class c
WHERE c.relname IN ('support_messages', 'support_chats');
