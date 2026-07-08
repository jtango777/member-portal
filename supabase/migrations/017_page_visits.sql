-- ============================================================
-- Page visit tracking — who visited Rooms/Haus Smiles and for how long
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS page_visits (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  path             TEXT        NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS page_visits_user_id_idx ON page_visits(user_id);
CREATE INDEX IF NOT EXISTS page_visits_started_at_idx ON page_visits(started_at);

-- No direct client access — all reads/writes go through API routes using the service role
ALTER TABLE page_visits ENABLE ROW LEVEL SECURITY;
