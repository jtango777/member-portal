-- ============================================================
-- Remove the "company admin" tier entirely. Site admin (is_admin)
-- remains — this only removes the scoped, self-serve company-roster role.
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE profiles DROP COLUMN IF EXISTS is_company_admin;
