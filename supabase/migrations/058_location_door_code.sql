-- The door code customers use to let themselves in, per location.
--
-- It lived in lib/locations.ts, so changing it meant a developer and a
-- deploy. A door code is exactly the kind of thing that changes without
-- warning, and the Marina confirmation email is the only thing standing
-- between a day passer and a locked door (Caroline, 2026-10-01).
--
-- Nullable: only Marina del Rey is self-entry today. A location with no code
-- simply has none in its email.
alter table public.locations
  add column if not exists door_code text;

update public.locations set door_code = '5075' where slug = 'marina-del-rey';
