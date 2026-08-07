-- Individual Room Hours become a plain, freely-editable number instead of a
-- locked-in tier (Virtual/Flex/Open/Dedicated) — real GetARoom hours don't
-- fit a fixed preset (bonus hours granted to specific people, etc.). The
-- membership_type_id columns stay in place (harmless, unused going forward)
-- so nothing is lost; this just adds the real field and backfills it from
-- whatever tier was already set, using that tier's hours_per_month value.
-- Run this in Supabase → SQL Editor → New query

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS individual_hours_allotment NUMERIC(10,2);
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS individual_hours_allotment NUMERIC(10,2);

UPDATE profiles p
SET individual_hours_allotment = mt.hours_per_month
FROM membership_types mt
WHERE p.membership_type_id = mt.id
  AND p.individual_hours_allotment IS NULL;

UPDATE permitted_emails pe
SET individual_hours_allotment = mt.hours_per_month
FROM membership_types mt
WHERE pe.membership_type_id = mt.id
  AND pe.individual_hours_allotment IS NULL;
