-- Which QuickBooks product/service each kind of sale is booked against.
--
-- Every receipt used to post against a single item called "Room Booking",
-- so day passes would have landed under it too and the Sales by
-- Product/Service report, the one the revenue baselines come from, would
-- have mixed the two streams and broken years of history (Caroline spotted
-- this 2026-09-25, before QuickBooks was pointed at the real companies).
--
-- The names differ per entity, which is why they live on the location rather
-- than in the code: El Segundo and Marina use "Event / Conference Rm Fee",
-- Costa Mesa uses "Conference Room Fee". These match the existing items in
-- each company's books exactly, so new sales continue the same lines.
alter table public.locations
  add column if not exists qb_day_pass_item text not null default 'Day Pass',
  add column if not exists qb_room_item     text not null default 'Event / Conference Rm Fee';

update public.locations set qb_room_item = 'Conference Room Fee'       where slug = 'costa-mesa';
update public.locations set qb_room_item = 'Event / Conference Rm Fee' where slug in ('el-segundo', 'marina-del-rey');
