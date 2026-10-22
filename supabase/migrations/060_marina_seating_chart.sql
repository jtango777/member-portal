-- Fills the Marina del Rey seating chart on Admin -> Labs with who sits
-- where today, as marked in red on Joe's plan (2026-10-22). From here on the
-- names are edited on the page. `desk` ids match lib/deskPlans.ts.
--
-- on conflict do nothing, so running this again never overwrites a name
-- someone has since changed.
insert into public.desk_assignments (plan, desk, name) values
  ('marina-del-rey', 'c1',         'Kevin'),
  ('marina-del-rey', 'c2',         'Justin'),
  ('marina-del-rey', 'c3',         'Rohan'),
  ('marina-del-rey', 'c14',        'Rainy'),
  ('marina-del-rey', 'a1',         'Kris'),
  ('marina-del-rey', 'b8',         'Can'),
  ('marina-del-rey', 'c15',        'Amanda'),
  ('marina-del-rey', 'a2',         'Jen'),
  ('marina-del-rey', 'c7',         'Jessica'),
  ('marina-del-rey', 'c6',         'Stephen'),
  ('marina-del-rey', 'c5',         'Keith'),
  ('marina-del-rey', 'c4',         'Doug'),
  ('marina-del-rey', 'mid-l-1',    'Nina'),
  ('marina-del-rey', 'mid-l-2',    'Kristin'),
  ('marina-del-rey', 'mid-l-3',    'Christina'),
  ('marina-del-rey', 'mid-r-1',    'Nicholas'),
  ('marina-del-rey', 'mid-r-2',    'Deb'),
  ('marina-del-rey', 'mid-r-3',    'Will'),
  ('marina-del-rey', 'office-2',   'Yupil'),
  ('marina-del-rey', 'office-3',   'Reed'),
  ('marina-del-rey', 'office-4-1', 'Shirley'),
  ('marina-del-rey', 'office-4-2', 'Rocko'),
  ('marina-del-rey', 'office-5-1', 'Nasoan'),
  ('marina-del-rey', 'office-5-2', 'Rozz'),
  ('marina-del-rey', 'office-6-1', 'Lauren'),
  ('marina-del-rey', 'office-6-2', 'Justin'),
  ('marina-del-rey', 'office-6-3', 'Klaus'),
  ('marina-del-rey', 'office-6-4', 'Caroline'),
  ('marina-del-rey', 'office-8',   'Brooks'),
  ('marina-del-rey', 'b-north',    'Neill'),
  ('marina-del-rey', 'b-south',    'Danny'),
  ('marina-del-rey', 'lobby-1',    'Jamie'),
  ('marina-del-rey', 'lobby-2',    'Lisa'),
  ('marina-del-rey', 'lobby-3',    'Ben'),
  ('marina-del-rey', 'lobby-4',    'Juan'),
  ('marina-del-rey', 'lobby-5',    'Kevin'),
  ('marina-del-rey', 'lobby-6',    'Aliyah')
on conflict (plan, desk) do nothing;
