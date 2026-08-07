-- Lets an admin mark a feedback item resolved, which removes it from the
-- Feedback list (no separate "resolved" view for now — keep it simple).
-- Run this in Supabase → SQL Editor → New query

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE POLICY "admin_update_feedback" ON feedback
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
