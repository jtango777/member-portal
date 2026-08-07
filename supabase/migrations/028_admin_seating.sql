-- Let an admin pre-set a member's seating from the Members page, not just
-- the member themself via Settings. Mirrors default_location_id, which
-- already lives on both permitted_emails (pre-signup) and profiles
-- (post-signup) so it carries over when the invite is accepted.
-- Run this in Supabase → SQL Editor → New query

ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS seating TEXT
  CHECK (seating IN ('Office - Main Building', 'Office - West Wing', 'Dedicated Desk', 'Open Desk'));
