-- Add separate first_name / last_name columns alongside the existing
-- full_name. full_name stays in place (still what most of the app reads
-- for display) but is now computed/kept in sync from these two whenever a
-- member is added, signs up, or is edited — so we have proper first/last
-- data to match against source data (e.g. getaroom CSV exports, which
-- always split name into two columns).

ALTER TABLE profiles         ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles         ADD COLUMN IF NOT EXISTS last_name  TEXT;
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS last_name  TEXT;
