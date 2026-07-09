-- ============================================================
-- Directory photos — static Haus Smiles entries not tied to a
-- login account (e.g. imported from the old WordPress directory).
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS directory_photos (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name   TEXT        NOT NULL,
  avatar_url  TEXT        NOT NULL,
  location_id UUID        REFERENCES locations(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE directory_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_directory_photos" ON directory_photos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "admin_manage_directory_photos" ON directory_photos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================================
-- Storage bucket for the imported directory photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('directory-photos', 'directory-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_directory_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'directory-photos');

CREATE POLICY "admin_manage_directory_photos_storage" ON storage.objects
  FOR ALL USING (
    bucket_id = 'directory-photos'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
