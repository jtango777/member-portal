-- Lets admins preset a location for someone before they've signed up
-- (mirrors the existing full_name pre-set pattern for pending members).
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS default_location_id UUID REFERENCES locations(id);
