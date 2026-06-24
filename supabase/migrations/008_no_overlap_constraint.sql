-- Prevent double-booking: no two reservations can overlap on the same room.
-- Uses a GiST exclusion constraint on (room_id, time range).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  );
