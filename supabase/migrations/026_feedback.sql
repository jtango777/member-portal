-- Member feedback submitted from the Faces page. Category + free text,
-- auto-attached to the submitting member (no anonymous option needed).

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_insert_own_feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "admin_read_feedback" ON feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
