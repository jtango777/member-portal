-- Mirrors external_bookable, but for the internal (member-facing) booking
-- calendar. Lets a room be temporarily hidden from members/admins booking
-- internally (e.g. out of service) without touching its external-booking
-- visibility, which is a separate, independent toggle.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS internal_bookable BOOLEAN NOT NULL DEFAULT TRUE;
