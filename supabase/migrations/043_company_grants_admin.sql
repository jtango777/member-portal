-- Lets a company be flagged so anyone who registers under it gets
-- is_admin=true automatically (e.g. BizHaus Admin, BizHaus Staff) —
-- an explicit, visible switch rather than inferring it from the
-- company's name, which is fragile (renames, typos, duplicates).
-- Off by default; existing admins were all granted manually and are
-- untouched by this — it only affects future registrations.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS grants_admin BOOLEAN NOT NULL DEFAULT FALSE;
