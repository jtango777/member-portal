-- Generalizing day_pass_customers → booking_customers before any real data
-- exists in it: day-pass buyers and repeat /book conference-room customers
-- are the same kind of person (not a member, but comes back) and should
-- share one account/login, not two separate systems. day_passes itself
-- stays day-pass-specific — only the account table needs to be shared.
-- /book's own reservation records will get wired to this table separately;
-- this migration is schema-only.

ALTER TABLE day_pass_customers RENAME TO booking_customers;

-- Row Level Security policy names don't follow the table automatically —
-- drop and recreate under the new, clearer names.
DROP POLICY IF EXISTS "customer_read_own_account" ON booking_customers;
CREATE POLICY "customer_read_own_account" ON booking_customers
  FOR SELECT USING (auth.uid() = id);
