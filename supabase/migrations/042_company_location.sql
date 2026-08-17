-- Explicit "which BizHaus location is this company under" field, per
-- Chris's clarification — a company's location shouldn't just be derived
-- from wherever its members happen to sit, it should be settable directly.
-- Nullable, and the derived-from-members lookup stays as a fallback for
-- the ~470 existing companies that won't have this set right away.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
