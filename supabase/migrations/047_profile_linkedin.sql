-- Self-serve LinkedIn link on a member's profile. Only the username segment
-- is stored (e.g. "janesmith", not a full URL) — the "https://linkedin.com/in/"
-- prefix is hardcoded everywhere this is read or written, both client and
-- server side, so a member can't paste an arbitrary link into this field.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_username TEXT;
