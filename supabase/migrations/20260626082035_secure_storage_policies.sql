-- =====================================================================
-- Migration: Secure storage policies for images bucket
-- Description: Revoke unsafe anon INSERT, UPDATE, and DELETE policies,
--              ensuring only SELECT is allowed for public anonymous users.
-- =====================================================================

-- 1. Remove insecure policies
DROP POLICY IF EXISTS "Anon can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Anon can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update images" ON storage.objects;

-- 2. Ensure only safe SELECT (read-only) policy exists for public users
DROP POLICY IF EXISTS "Anon can view images" ON storage.objects;
CREATE POLICY "Anon can view images" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'images');
