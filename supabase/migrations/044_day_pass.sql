-- Day pass customers + reservations.
--
-- Deliberately separate from profiles/permitted_emails: day pass buyers
-- (and eventually repeat /book customers) are not BizHaus members. They
-- get their own lightweight account (still backed by Supabase Auth, so
-- login/password reset all just work) but must never show up in the
-- Members admin table or gain any member-portal access. Row Level
-- Security enforces that on the read side; every write goes through the
-- service-role admin client from API routes, same convention as
-- external_bookings.

CREATE TABLE IF NOT EXISTS day_pass_customers (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS day_passes (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id               UUID        NOT NULL REFERENCES day_pass_customers(id) ON DELETE CASCADE,
  location_id               UUID        NOT NULL REFERENCES locations(id),
  date                       DATE        NOT NULL,
  price_cents                INTEGER     NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'declined'
  stripe_payment_intent_id   TEXT,
  confirmation_number         TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT day_passes_status_check CHECK (status IN ('pending', 'confirmed', 'declined'))
);

ALTER TABLE day_pass_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_passes ENABLE ROW LEVEL SECURITY;

-- A day-pass customer can read (only) their own account and their own
-- reservations — no cross-customer visibility, and no member/admin
-- visibility either (admins query these via the service-role client if
-- ever needed, same as everything else in this app).
CREATE POLICY "customer_read_own_account" ON day_pass_customers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "customer_read_own_passes" ON day_passes
  FOR SELECT USING (auth.uid() = customer_id);
