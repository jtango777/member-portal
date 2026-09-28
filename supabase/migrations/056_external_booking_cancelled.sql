-- Let a room booking be cancelled.
--
-- Rooms are sold as non-refundable, so until now the only statuses were
-- pending, confirmed and declined, and the check constraint from 005
-- rejected anything else. Staff now have an override for the times someone
-- calls and we decide to make an exception (Caroline, 2026-09-28), so the
-- status has to be able to say so.
alter table public.external_bookings drop constraint if exists valid_status;
alter table public.external_bookings
  add constraint valid_status check (status in ('pending', 'confirmed', 'declined', 'cancelled'));

alter table public.external_bookings
  add column if not exists cancelled_at timestamptz;
