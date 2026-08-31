-- Self-serve day-pass cancellation (2026-08-31). Conference room bookings
-- deliberately do NOT get this — no cancellations at all there, per
-- Caroline. Day passes are more lax: most people don't even need a
-- reservation, this is just for planners who'd otherwise call, so a
-- 12-hour-notice self-serve cancel + refund is the policy here.

ALTER TABLE day_passes DROP CONSTRAINT IF EXISTS day_passes_status_check;
ALTER TABLE day_passes ADD CONSTRAINT day_passes_status_check
  CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled'));

ALTER TABLE day_passes ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Captured off the QuickBooks sales receipt at creation time (Stripe
-- webhook), so a later cancellation can void the right receipt instead of
-- having to search QB for it.
ALTER TABLE day_passes ADD COLUMN IF NOT EXISTS qb_receipt_id TEXT;
