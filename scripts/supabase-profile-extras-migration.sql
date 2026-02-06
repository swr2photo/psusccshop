-- Migration: Add profile_image and theme columns to profiles table
-- Run this in the Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/skfacffsynjxyvvvuycl/sql/new
--
-- After running this migration, the profile-extras key_value_store entries
-- are still read as a fallback, so no data is lost.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme VARCHAR(10);

-- Optional: migrate existing extras from key_value_store to profiles table
-- (run after the ALTER TABLE above)
-- UPDATE profiles p
-- SET profile_image = (kv.value->>'profileImage'),
--     theme = (kv.value->>'theme')
-- FROM key_value_store kv
-- WHERE kv.key = 'profile-extras/' || p.email_hash || '.json'
--   AND kv.value IS NOT NULL;
