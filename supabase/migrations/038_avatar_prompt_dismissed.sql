-- Persists the "add your photo" reminder dismissal so it only ever shows
-- once per member, not on every fresh login (it was previously tracked in
-- sessionStorage, which resets on every new browser session).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_prompt_dismissed BOOLEAN NOT NULL DEFAULT FALSE;
