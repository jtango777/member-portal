-- Soft-delete for members: "removing" a member flags them inactive
-- instead of deleting their permitted_emails row, so they can be
-- listed separately and restored later.
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
