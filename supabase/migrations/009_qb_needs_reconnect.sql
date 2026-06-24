-- Track when a QB connection needs re-authentication (expired refresh token)
ALTER TABLE qb_tokens ADD COLUMN IF NOT EXISTS needs_reconnect BOOLEAN NOT NULL DEFAULT false;
