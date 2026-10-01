-- A phone number for every booking customer.
--
-- /book has always asked for one, because it began life as a request flow
-- where staff rang people back to confirm. Day passes never asked, so for a
-- day passer we had only an email. That matters at Marina, which is
-- self-entry on a door code: if the code changes or somebody cannot get in,
-- email is useless.
--
-- Joe's call, 2026-10-01: required on both.
--
-- Nullable on purpose. Everyone who bought before today has no number, and
-- backfilling a required column would mean inventing data.
alter table public.booking_customers
  add column if not exists phone text;
