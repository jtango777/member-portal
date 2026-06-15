-- Phase 3: Recurring admin blocks
-- Run this in Supabase → SQL Editor → New query

-- 1. Add recurrence columns to reservations
ALTER TABLE reservations
  ADD COLUMN recurrence_group_id UUID,
  ADD COLUMN is_admin_block      BOOLEAN NOT NULL DEFAULT false;

-- 2. Index for efficient group lookups (delete this + future)
CREATE INDEX idx_reservations_recurrence_group
  ON reservations(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
