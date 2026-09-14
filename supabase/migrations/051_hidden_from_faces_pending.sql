-- Same as migration 050, but for pending invites — Faces now shows pending
-- members too (not just registered ones), so admins need the same
-- hide-from-Faces toggle for a pending person (e.g. a known-virtual member)
-- that already exists on profiles. Default false so nothing existing
-- is affected.

ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS hidden_from_faces BOOLEAN NOT NULL DEFAULT false;
