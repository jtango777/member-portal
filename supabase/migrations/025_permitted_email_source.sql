-- Tags how/when a permitted_emails row was created (e.g. a specific bulk
-- import batch), so batches can be identified and undone later.
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS source TEXT;
