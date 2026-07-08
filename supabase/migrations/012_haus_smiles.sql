-- ============================================================
-- Haus Smiles — member profile photos
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Photo + home location on each member's profile
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- ============================================================
-- Storage bucket for profile photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view photos (bucket is public, but RLS still gates direct table access)
CREATE POLICY "public_read_avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- A member can only upload/replace/delete their own photo.
-- Enforced by requiring the file path to start with their user id, e.g. "{user_id}/photo.jpg"
CREATE POLICY "member_upload_own_avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "member_update_own_avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "member_delete_own_avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
