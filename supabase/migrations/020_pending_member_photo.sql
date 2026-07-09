-- ============================================================
-- Let admins pre-assign a photo to a pending (not-yet-registered)
-- member. Carried over to their profile once they accept the invite.
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS avatar_url TEXT;
