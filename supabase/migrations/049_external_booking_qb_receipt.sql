-- Mirrors day_passes.qb_receipt_id (048) — external_bookings never got this
-- column since room bookings don't support self-serve cancellation (so
-- there was nothing to void). Added now purely so /api/book/request can
-- record which QuickBooks sales receipt it created for a booking, same
-- idempotency pattern as day passes.
ALTER TABLE external_bookings ADD COLUMN IF NOT EXISTS qb_receipt_id TEXT;
