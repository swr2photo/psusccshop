-- Supabase Storage Setup for Images
-- Run this in Supabase SQL Editor to create the images bucket

-- ==================== CREATE STORAGE BUCKET ====================
-- Create a public bucket for images (URLs will never expire)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,  -- public bucket = permanent URLs
  5242880,  -- 5MB file size limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

-- ==================== STORAGE POLICIES ====================
-- Allow public read access (anyone can view images)

DROP POLICY IF EXISTS "Public read access for images" ON storage.objects;
CREATE POLICY "Public read access for images" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'images');

-- Allow authenticated users to upload (via service role)
DROP POLICY IF EXISTS "Service role can upload images" ON storage.objects;
CREATE POLICY "Service role can upload images" ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'images');

-- Allow service role to delete images
DROP POLICY IF EXISTS "Service role can delete images" ON storage.objects;
CREATE POLICY "Service role can delete images" ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'images');

-- Allow service role to update images
DROP POLICY IF EXISTS "Service role can update images" ON storage.objects;
CREATE POLICY "Service role can update images" ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'images');

-- ==================== VERIFICATION ====================
-- Run this to verify the bucket was created

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'images';
