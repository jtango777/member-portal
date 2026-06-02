-- ============================================================
-- BizHaus Room Reservation System — Database Schema
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID    NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  capacity    INTEGER NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- Companies (every member, individual or group, belongs to a company)
CREATE TABLE IF NOT EXISTS companies (
  id                      UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  name                    TEXT           NOT NULL,
  monthly_hours_allotment DECIMAL(10,2)  NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID        REFERENCES companies(id) ON DELETE SET NULL,
  full_name  TEXT        NOT NULL DEFAULT '',
  is_admin   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permitted emails — admin-controlled invite list
CREATE TABLE IF NOT EXISTS permitted_emails (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  email        TEXT        NOT NULL UNIQUE,
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invite_token TEXT        UNIQUE,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ
);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  notes      TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE locations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE permitted_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations    ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read everything
CREATE POLICY "auth_read_locations"        ON locations        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_rooms"            ON rooms            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_companies"        ON companies        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_profiles"         ON profiles         FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_permitted_emails" ON permitted_emails FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read_reservations"     ON reservations     FOR SELECT USING (auth.role() = 'authenticated');

-- Writes are done via service_role from API routes (bypasses RLS)

-- ============================================================
-- Seed Data — Locations & Rooms
-- ============================================================

INSERT INTO locations (id, name, slug) VALUES
  ('11111111-1111-1111-1111-111111111101', 'El Segundo',     'el-segundo'),
  ('11111111-1111-1111-1111-111111111102', 'Marina del Rey', 'marina-del-rey'),
  ('11111111-1111-1111-1111-111111111103', 'Costa Mesa',     'costa-mesa')
ON CONFLICT (slug) DO NOTHING;

-- El Segundo
INSERT INTO rooms (location_id, name, capacity, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Large Conference', 16, 1),
  ('11111111-1111-1111-1111-111111111101', 'Medium Conference', 8, 2),
  ('11111111-1111-1111-1111-111111111101', 'Small Meeting',     5, 3),
  ('11111111-1111-1111-1111-111111111101', 'Library',           6, 4)
ON CONFLICT DO NOTHING;

-- Marina del Rey
INSERT INTO rooms (location_id, name, capacity, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111102', 'Conference Room',    7, 1),
  ('11111111-1111-1111-1111-111111111102', 'Left Phone Booth',   1, 2),
  ('11111111-1111-1111-1111-111111111102', 'Right Phone Booth',  1, 3)
ON CONFLICT DO NOTHING;

-- Costa Mesa
INSERT INTO rooms (location_id, name, capacity, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111103', 'Board Room w/ Apple TV', 16, 1),
  ('11111111-1111-1111-1111-111111111103', 'Servco w/ Apple TV',      8, 2),
  ('11111111-1111-1111-1111-111111111103', 'Library East',            7, 3),
  ('11111111-1111-1111-1111-111111111103', 'Library West',            7, 4)
ON CONFLICT DO NOTHING;
