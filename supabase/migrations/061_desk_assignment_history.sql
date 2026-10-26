-- History for the seating charts on Admin -> Labs, so a chart can be shown
-- as it stood at any earlier date and time (Joe, 2026-10-22). The page that
-- showed it was taken out the same day; the log is kept so it can return.
--
-- One row per change to a seat: the name it took, or null when the seat was
-- freed. The chart at time T is each seat's latest row at or before T.
create table if not exists public.desk_assignment_history (
  id          bigint generated always as identity primary key,
  plan        text not null,
  desk        text not null,
  name        text,
  changed_at  timestamptz not null default now(),
  changed_by  uuid references auth.users(id) on delete set null
);

create index if not exists desk_assignment_history_plan_changed_at
  on public.desk_assignment_history (plan, changed_at);

-- Admins only, through the service-role client, like desk_assignments.
alter table public.desk_assignment_history enable row level security;

-- Recorded by trigger rather than by the API route, so names put in by a
-- migration (060's Marina starting names) are history too. A save that
-- leaves the name unchanged records nothing. On delete, changed_by is the
-- row's last updated_by: the API stamps that with whoever cleared the seat
-- just before deleting it.
create or replace function public.record_desk_assignment_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into desk_assignment_history (plan, desk, name, changed_by)
    values (old.plan, old.desk, null, old.updated_by);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.name is not distinct from old.name then
    return new;
  end if;
  insert into desk_assignment_history (plan, desk, name, changed_by)
  values (new.plan, new.desk, new.name, new.updated_by);
  return new;
end;
$$;

drop trigger if exists desk_assignments_history on public.desk_assignments;
create trigger desk_assignments_history
  after insert or update or delete on public.desk_assignments
  for each row execute function public.record_desk_assignment_change();

-- Seats already filled before this ran get a starting entry dated when they
-- were last set. Anything cleared or changed before then was not kept.
insert into public.desk_assignment_history (plan, desk, name, changed_at, changed_by)
select a.plan, a.desk, a.name, a.updated_at, a.updated_by
from public.desk_assignments a
where not exists (
  select 1 from public.desk_assignment_history h where h.plan = a.plan and h.desk = a.desk
);
