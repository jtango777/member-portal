-- Stops a booking getting two QuickBooks sales receipts (Joe, 2026-11-04).
--
-- Each paid day pass and room booking is receipted in QuickBooks twice over:
-- by the booking route right after it saves the booking, and by the Stripe
-- webhook as a backup. The backup skipped bookings that already had a
-- qb_receipt_id, but that id is only written once QuickBooks has answered,
-- several seconds later. A webhook landing in that gap made a second
-- receipt, and, both looking the guest up at once, a second customer:
-- DeShawn Samad's day pass on 2026-11-02 got two of each.
--
-- Whichever path gets there first now stamps qb_receipt_claimed_at before
-- talking to QuickBooks, in a single conditional update, and the other sees
-- the stamp and leaves it. A claim older than ten minutes with still no
-- receipt is treated as abandoned (that path crashed), so the other path
-- can still step in. See lib/qbReceiptClaim.ts.
alter table public.day_passes
  add column if not exists qb_receipt_claimed_at timestamptz;

alter table public.external_bookings
  add column if not exists qb_receipt_claimed_at timestamptz;
