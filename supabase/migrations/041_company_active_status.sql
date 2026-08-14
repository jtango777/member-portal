-- Soft-delete for companies, same pattern as members
-- (023_member_active_status.sql): "removing" a company flags it inactive
-- instead of deleting the row, so existing reservations/feedback/usage
-- history that points at it via company_id stays intact and attributable,
-- and it can be restored later. It just disappears from the active
-- Companies list and moves to a separate Inactive Companies list.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
