-- The day pass price and the closure-day list were constants in the code, so
-- changing either meant a developer and a deploy. Caroline asked for both to
-- be editable from the admin dashboard (2026-09-25).

-- Small key/value table for settings that don't deserve a column of their own.
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

insert into public.app_settings (key, value)
values ('day_pass_price_cents', '3000'::jsonb)
on conflict (key) do nothing;

-- Days BizHaus is shut. One list, but each day says what it blocks, because
-- a day the coworking floor is closed isn't automatically a day a booked
-- conference room can't go ahead.
create table if not exists public.closure_days (
  date             date primary key,
  name             text not null,
  blocks_day_pass  boolean not null default true,
  blocks_rooms     boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Seeded from lib/holidays.ts, which this table replaces.
insert into public.closure_days (date, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-01-19', 'MLK Day'),
  ('2026-02-16', 'Presidents'' Day'),
  ('2026-05-25', 'Memorial Day'),
  ('2026-07-03', 'Day before July 4th'),
  ('2026-09-07', 'Labor Day'),
  ('2026-11-26', 'Thanksgiving'),
  ('2026-11-27', 'Day after Thanksgiving'),
  ('2026-12-24', 'Christmas Eve'),
  ('2026-12-25', 'Christmas Day'),
  ('2027-01-01', 'New Year''s Day'),
  ('2027-01-18', 'MLK Day'),
  ('2027-02-15', 'Presidents'' Day'),
  ('2027-05-31', 'Memorial Day'),
  ('2027-07-05', 'July 4th observed'),
  ('2027-09-06', 'Labor Day'),
  ('2027-11-25', 'Thanksgiving'),
  ('2027-11-26', 'Day after Thanksgiving'),
  ('2027-12-24', 'Christmas Eve'),
  ('2027-12-25', 'Christmas Day')
on conflict (date) do nothing;

alter table public.app_settings  enable row level security;
alter table public.closure_days  enable row level security;

-- Both are public knowledge: the price is on the checkout page and the closed
-- days are greyed out in the pickers. Writes go through admin-only API routes
-- using the service-role client, so no write policy is granted here.
drop policy if exists "Anyone can read app settings"  on public.app_settings;
create policy "Anyone can read app settings"  on public.app_settings  for select using (true);

drop policy if exists "Anyone can read closure days" on public.closure_days;
create policy "Anyone can read closure days" on public.closure_days for select using (true);
