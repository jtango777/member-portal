-- ============================================================
-- Member profile additions — soft removal + parking
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Soft-removal flag: company admins "remove" someone by flagging them
-- inactive rather than revoking their login. Inactive members are hidden
-- from Haus Smiles and the active member list, but keep their account.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Parking: license plate, self-serve in Settings
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_plate TEXT;
