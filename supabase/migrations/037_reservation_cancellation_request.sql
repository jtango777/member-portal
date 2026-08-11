-- Tracks when a member requests to cancel a reservation within the
-- 12-hour window (too close to the start time to self-cancel) — the
-- request goes to the BizHaus team for approval instead of cancelling
-- outright.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;
