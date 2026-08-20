-- /book is moving from fully-anonymous guest checkout to requiring a
-- booking_customers account (same shared account system day passes use),
-- matching the Industrious reference model. Link each external booking to
-- the account that made it.
ALTER TABLE external_bookings
  ADD COLUMN customer_id UUID REFERENCES booking_customers(id);

CREATE INDEX IF NOT EXISTS idx_external_bookings_customer_id ON external_bookings(customer_id);

-- Tighten RLS while we're in here: the existing policy let ANY
-- authenticated user read every external booking (every guest's name,
-- email, phone) — harmless back when the only authenticated users were
-- members/admins, but no longer true now that day-pass/booking customers
-- are real Supabase Auth users too. Replace with admin-only + a
-- customer's-own-bookings policy, same pattern as day_passes.
DROP POLICY IF EXISTS "auth_read_external_bookings" ON external_bookings;

CREATE POLICY "admin_read_external_bookings" ON external_bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "customer_read_own_external_bookings" ON external_bookings
  FOR SELECT USING (auth.uid() = customer_id);
