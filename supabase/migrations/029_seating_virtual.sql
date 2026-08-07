-- Add "Virtual" as a seating option (maps to the Virtual Plan / 1h Room
-- Hours tier) on both profiles and permitted_emails.
-- Run this in Supabase → SQL Editor → New query

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_seating_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_seating_check
  CHECK (seating IN ('Virtual', 'Office - Main Building', 'Office - West Wing', 'Dedicated Desk', 'Open Desk'));

ALTER TABLE permitted_emails DROP CONSTRAINT IF EXISTS permitted_emails_seating_check;
ALTER TABLE permitted_emails ADD CONSTRAINT permitted_emails_seating_check
  CHECK (seating IN ('Virtual', 'Office - Main Building', 'Office - West Wing', 'Dedicated Desk', 'Open Desk'));
