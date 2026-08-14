-- Internal triage fields for feedback: a free-text note, and who on the
-- team it's assigned to. Also the reason "resolved" items disappeared
-- forever (030_feedback_resolved.sql) was a deliberate simplification at
-- the time ("no separate resolved view for now") — this migration doesn't
-- change that filter itself, the app code adds a Resolved tab on top of it.

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;
