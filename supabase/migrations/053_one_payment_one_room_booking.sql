-- One Stripe payment can only ever pay for one room booking.
--
-- /api/book/request already refuses a payment it has seen before (added
-- 2026-09-22, after testing found a paid booking's payment could be sent
-- again for a second slot and got it free). That check reads the table and
-- then writes, so two requests arriving in the same instant could both pass
-- it. This index makes the database itself the referee.
--
-- Day passes deliberately have no equivalent: one payment there legitimately
-- covers several rows, one per day, sharing a confirmation number.
create unique index if not exists external_bookings_one_payment_per_booking
  on public.external_bookings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
