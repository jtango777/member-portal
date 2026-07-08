-- ============================================================
-- Announcements — admin-posted one-time popups shown to members
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  message    TEXT        NOT NULL,
  created_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_announcements" ON announcements FOR SELECT USING (auth.role() = 'authenticated');

-- Tracks the last announcement each member has dismissed
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dismissed_announcement_id UUID REFERENCES announcements(id) ON DELETE SET NULL;
