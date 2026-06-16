-- Phase 3: External bookings table
-- Run this in Supabase → SQL Editor → New query

-- 1. Flag on reservations so external booking blocks are identifiable
--    Also relax NOT NULL on user_id/company_id — external bookings have no member user
ALTER TABLE reservations
  ADD COLUMN is_external_booking BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN user_id    DROP NOT NULL,
  ALTER COLUMN company_id DROP NOT NULL;

-- 2. External bookings table — stores lead/request details
CREATE TABLE external_bookings (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                   UUID        NOT NULL REFERENCES rooms(id),
  reservation_id            UUID        REFERENCES reservations(id) ON DELETE SET NULL,
  external_name             TEXT        NOT NULL,
  external_email            TEXT        NOT NULL,
  external_phone            TEXT        NOT NULL,
  company_name              TEXT,
  notes                     TEXT,
  start_time                TIMESTAMPTZ NOT NULL,
  end_time                  TIMESTAMPTZ NOT NULL,
  status                    TEXT        NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id  TEXT,       -- reserved for Stripe integration
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'declined'))
);

-- 3. RLS — authenticated users (admins) can read; writes go through service_role API
ALTER TABLE external_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_external_bookings"
  ON external_bookings FOR SELECT
  USING (auth.role() = 'authenticated');
