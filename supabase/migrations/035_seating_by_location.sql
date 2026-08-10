-- Costa Mesa and Marina del Rey use a plain "Office" option (only El Segundo
-- has the two building variants) — widen the constraint to allow it.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_seating_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_seating_check
  CHECK (seating IN ('Virtual', 'Office', 'Office - Main Building', 'Office - West Wing', 'Dedicated Desk', 'Open Desk'));

ALTER TABLE permitted_emails DROP CONSTRAINT IF EXISTS permitted_emails_seating_check;
ALTER TABLE permitted_emails ADD CONSTRAINT permitted_emails_seating_check
  CHECK (seating IN ('Virtual', 'Office', 'Office - Main Building', 'Office - West Wing', 'Dedicated Desk', 'Open Desk'));
