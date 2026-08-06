-- Phase: Make "company" optional for a member.
-- A member only needs a company when they're sharing an hour pool with
-- other people under the same company name. A standalone individual can
-- instead carry their own membership_type_id directly, and their hours are
-- tracked against just their own bookings (not pooled with anyone).
-- Run this in Supabase → SQL Editor → New query

-- 1. Company is no longer required on a pending invite
ALTER TABLE permitted_emails
  ALTER COLUMN company_id DROP NOT NULL;

-- 2. Let an individual (no company) carry their own membership type directly
ALTER TABLE profiles
  ADD COLUMN membership_type_id UUID REFERENCES membership_types(id) ON DELETE SET NULL;

ALTER TABLE permitted_emails
  ADD COLUMN membership_type_id UUID REFERENCES membership_types(id) ON DELETE SET NULL;
