-- ============================================================
-- Room access requests — for portal members who aren't yet
-- linked to a company/hours allotment in the rooms system.
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS room_access_prompted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS room_access_requested_at TIMESTAMPTZ;
