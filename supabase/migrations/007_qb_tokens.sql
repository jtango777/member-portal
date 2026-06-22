-- QuickBooks OAuth token storage — one row per location
-- Run this in Supabase → SQL Editor → New query

CREATE TABLE qb_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id     UUID        NOT NULL REFERENCES locations(id) UNIQUE,
  realm_id        TEXT        NOT NULL,  -- QuickBooks company ID
  access_token    TEXT        NOT NULL,
  refresh_token   TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE qb_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_qb_tokens"
  ON qb_tokens FOR SELECT
  USING (auth.role() = 'authenticated');
