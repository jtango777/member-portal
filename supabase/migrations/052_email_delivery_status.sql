-- Delivery problems reported back by Resend (via its webhook) for an
-- invite address: 'bounced' (the recipient's mail server rejected it, e.g.
-- the mailbox doesn't exist) or 'complained' (the recipient marked it as
-- spam). Before this, the portal handed emails to Resend and never heard
-- what happened, so a bounced invite still showed as "Invited."
--
-- Cleared back to null whenever a fresh invite is sent to the person, so a
-- corrected address doesn't stay flagged.

ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS email_status TEXT
  CHECK (email_status IN ('bounced', 'complained'));
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS email_status_reason TEXT;
ALTER TABLE permitted_emails ADD COLUMN IF NOT EXISTS email_status_at TIMESTAMPTZ;
