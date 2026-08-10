-- Lets a historical (pre-portal) reservation stay linked to the real
-- person who booked it, even before they have an account. When that
-- person signs up, their historical bookings are reassigned to their new
-- profile — see app/api/invites/accept and accept-by-email.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS historical_email TEXT;
