-- A real confirmation number for conference room bookings.
--
-- Day passes have had one since launch: a stored, random 8-character code
-- a customer can read out and staff can search for. Room bookings never
-- did. The number on the receipt email and in My Bookings was the first
-- eight characters of the row's UUID, computed on the fly, stored nowhere
-- and matched by nothing: admin search looks at title, room, location,
-- member and company, so a customer ringing up and quoting their number
-- could not be found at all (Caroline, 2026-11-20).
--
-- That matters now because cancelling a room booking leaves credit which
-- is redeemed only by telephone, against this number.
--
-- Backfilled from the existing id prefix so that every number already
-- sitting in somebody's inbox still matches the booking it came from.

alter table external_bookings
  add column if not exists confirmation_number text;

update external_bookings
   set confirmation_number = upper(substring(id::text, 1, 8))
 where confirmation_number is null;

-- Unique rather than a primary key: it is a human handle, not an
-- identity. Partial, so the column can stay nullable for any row that
-- somehow arrives without one rather than failing the insert.
create unique index if not exists external_bookings_confirmation_number_key
  on external_bookings (confirmation_number)
  where confirmation_number is not null;

create index if not exists external_bookings_confirmation_number_lookup
  on external_bookings (confirmation_number);
