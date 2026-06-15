-- Phase 3: External Booking — Room fields
-- Run this in Supabase → SQL Editor → New query

-- 1. Add new columns to rooms table
ALTER TABLE rooms
  ADD COLUMN external_name     TEXT,
  ADD COLUMN price_per_hour    NUMERIC,
  ADD COLUMN external_bookable BOOLEAN NOT NULL DEFAULT false;

-- 2. Fix Library West capacity (was incorrectly set to 7, should be 4–5)
UPDATE rooms
SET capacity = 5
WHERE name = 'Library West'
  AND location_id = '11111111-1111-1111-1111-111111111103';

-- 3. Set external_name, price_per_hour, external_bookable for externally-bookable rooms

-- El Segundo
UPDATE rooms SET external_name = 'Large',    price_per_hour = 100, external_bookable = true
WHERE name = 'Large Conference'
  AND location_id = '11111111-1111-1111-1111-111111111101';

UPDATE rooms SET external_name = 'Medium +', price_per_hour = 75,  external_bookable = true
WHERE name = 'Medium Conference'
  AND location_id = '11111111-1111-1111-1111-111111111101';

UPDATE rooms SET external_name = 'Medium',   price_per_hour = 65,  external_bookable = true
WHERE name = 'Library'
  AND location_id = '11111111-1111-1111-1111-111111111101';

UPDATE rooms SET external_name = 'Small',    price_per_hour = 50,  external_bookable = true
WHERE name = 'Small Meeting'
  AND location_id = '11111111-1111-1111-1111-111111111101';

-- Costa Mesa
UPDATE rooms SET external_name = 'Large',    price_per_hour = 100, external_bookable = true
WHERE name = 'Board Room w/ Apple TV'
  AND location_id = '11111111-1111-1111-1111-111111111103';

UPDATE rooms SET external_name = 'Medium +', price_per_hour = 75,  external_bookable = true
WHERE name = 'Servco w/ Apple TV'
  AND location_id = '11111111-1111-1111-1111-111111111103';

UPDATE rooms SET external_name = 'Medium',   price_per_hour = 65,  external_bookable = true
WHERE name = 'Library East'
  AND location_id = '11111111-1111-1111-1111-111111111103';

UPDATE rooms SET external_name = 'Small',    price_per_hour = 65,  external_bookable = true
WHERE name = 'Library West'
  AND location_id = '11111111-1111-1111-1111-111111111103';

-- Marina del Rey
UPDATE rooms SET external_name = 'Small',    price_per_hour = 65,  external_bookable = true
WHERE name = 'Conference Room'
  AND location_id = '11111111-1111-1111-1111-111111111102';

-- Left Phone Booth and Right Phone Booth remain external_bookable = false (internal only)
