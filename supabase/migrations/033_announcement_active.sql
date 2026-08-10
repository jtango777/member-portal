-- Lets an admin turn off the current announcement without posting a
-- replacement (leaving nothing shown), instead of "current" always just
-- being whichever row is most recent.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- Preserve current behavior on existing data: only the most recent
-- announcement was ever actually shown to members, so mark everything
-- else as already-inactive history.
UPDATE announcements SET active = FALSE
WHERE id NOT IN (
  SELECT id FROM announcements ORDER BY created_at DESC LIMIT 1
);
