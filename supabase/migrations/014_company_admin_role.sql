-- ============================================================
-- Company admin role — self-serve roster management scoped to
-- a single company, distinct from full site admin.
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_company_admin BOOLEAN NOT NULL DEFAULT FALSE;
