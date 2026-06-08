-- Phase 2: Membership Types
-- Run this in Supabase → SQL Editor → New query

-- 1. Create membership_types table
CREATE TABLE membership_types (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  hours_per_month  NUMERIC,    -- null = per-person or custom (e.g. Private Office)
  sort_order       INTEGER     DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS (authenticated users can read; writes go through service_role API)
ALTER TABLE membership_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON membership_types FOR SELECT TO authenticated USING (true);

-- 3. Seed the 5 standard tiers
INSERT INTO membership_types (name, hours_per_month, sort_order) VALUES
  ('Virtual Plan',    1,    1),
  ('Flex Desk',       2,    2),
  ('Open Desk',       4,    3),
  ('Dedicated Desk',  6,    4),
  ('Private Office',  NULL, 5);  -- per-person, hours vary — assign manually

-- 4. Add membership_type_id to companies (nullable — existing companies start unassigned)
ALTER TABLE companies
  ADD COLUMN membership_type_id UUID REFERENCES membership_types(id) ON DELETE SET NULL;
