-- Tracks whether a member has seen their first "Welcome" — after that,
-- the dashboard greeting switches to "Welcome back" permanently.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcomed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: everyone who already has a profile has obviously logged in
-- before, so they should see "Welcome back", not "Welcome", on their next
-- visit — only brand-new signups going forward get the first-time greeting.
UPDATE profiles SET welcomed = TRUE;
