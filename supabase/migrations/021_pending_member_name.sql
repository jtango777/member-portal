-- ============================================================
-- Let admins pre-fill an expected name for a pending (not-yet-
-- registered) invite, same pattern as the pending-photo feature.
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS full_name TEXT;
