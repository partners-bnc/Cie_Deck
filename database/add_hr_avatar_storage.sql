-- ==============================================================================
-- Migration: Add HR Profile Photo Storage & avatar_url Column
-- ==============================================================================

-- 1. Add avatar_url column to admin_users table
ALTER TABLE public.admin_users 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Create the 'admin-avatars' storage bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-avatars',
  'admin-avatars',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Storage bucket access policies
-- Allow public viewing of avatar images
DROP POLICY IF EXISTS "Public can view admin avatars" ON storage.objects;
CREATE POLICY "Public can view admin avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'admin-avatars');

-- Allow inserting admin avatars
DROP POLICY IF EXISTS "Allow upload of admin avatars" ON storage.objects;
CREATE POLICY "Allow upload of admin avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'admin-avatars');

-- Allow updating admin avatars
DROP POLICY IF EXISTS "Allow update of admin avatars" ON storage.objects;
CREATE POLICY "Allow update of admin avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'admin-avatars');

-- 4. Ensure admin_users table allows updating avatar_url
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'admin_users' 
      AND rowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "Allow update avatar_url on admin_users" ON public.admin_users;
    CREATE POLICY "Allow update avatar_url on admin_users"
    ON public.admin_users FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
