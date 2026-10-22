-- Who sits at which desk in the El Segundo pods (Joe, 2026-10-21).
--
-- Shown on Admin -> Labs as a floor plan with a name box beside every desk.
-- One row per desk that has someone written against it; an empty desk has
-- no row. `plan` names the floor plan (lib/deskPlans.ts) and `desk` the seat
-- on it, e.g. '201-3', so another building or floor can be added later
-- without a schema change.
create table if not exists public.desk_assignments (
  plan        text not null,
  desk        text not null,
  name        text not null check (char_length(name) between 1 and 10),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null,
  primary key (plan, desk)
);

-- Admins only. The page reads and the API route writes with the
-- service-role client, so no policy is granted to anyone else.
alter table public.desk_assignments enable row level security;
