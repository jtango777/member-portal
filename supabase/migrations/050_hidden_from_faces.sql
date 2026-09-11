-- Lets a specific profile be kept (e.g. an admin's own test account) without
-- showing up on the Faces page for non-admins. Admins still see everything —
-- this only filters the query non-admins get. Default false so nothing
-- existing is affected.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hidden_from_faces BOOLEAN NOT NULL DEFAULT false;
