# Account transfer checklist

Built from the code on 2026-10-26, not from memory. Every external service
the five production projects actually depend on, found by reading every
environment variable and every outbound hostname in all five repositories.

Caroline's last day is **Wednesday 2026-10-28**. Anything still in her name
after that is reachable only by asking her as a favour.

Mark each line **done** as it is transferred. A line that is not ticked is a
thing that stops working, or stops being changeable, when her access ends.

---

## The five production projects

| Project | What it serves | Repo | Vercel project |
|---|---|---|---|
| BizHaus portal | members.bizhaus.com, bookings.bizhaus.com | `carolinebizhaus/portal` | `bizhaus` |
| Tucson marketing | tucsontherapysuites.com | `carolinebizhaus/TucsonTherapySuites` | `tucsontherapysuites` |
| Tucson booking | book.tucsontherapysuites.com | `joetherapy/tucsontherapybooking` | `tucson-therapy-booking` |
| Tucson mail | mail.tucsontherapysuites.com | `carolinebizhaus/tucsonmailservice` | `tucson-mail` |
| Secura Way | industrialforrent.com | `carolinebizhaus/industrialforrent` | `industrialforrent` |

---

## 1. Hosting and code

- [ ] **Vercel.** All five projects are on `caroline-2678's projects`, a
  personal account on the paid Pro plan. Nobody else can deploy, change a
  setting, or see the bill. Create a company team, then Project → Settings →
  General → **Transfer Project** for each of the five. Environment variables
  and domains normally travel with the project; check both afterwards and
  redeploy rather than assuming. **Needs a company card from Joe.**
- [ ] **GitHub.** Four of the five repos are on Caroline's personal account
  (`carolinebizhaus`). Only the Tucson booking repo is Joe's. Create an
  organisation and transfer them, or at minimum add an owner.

## 2. Data

- [ ] **Supabase, BizHaus production.** Project `chynzjrhyuavuuewfcap`. Holds
  members, companies, bookings, customers. Add the successor as owner.
- [ ] **Supabase, BizHaus staging.** `urecohfkovxfprtxqchl`, already on Joe's
  account. Confirm only.
- [ ] **Supabase, Tucson booking.** Its own project. Add an owner.
- [ ] **Supabase, Tucson mail.** Its own project. Add an owner.
- [ ] **Vercel Blob storage.** Secura Way uses `BLOB_READ_WRITE_TOKEN` for its
  listing images. Moves with the Vercel project.

## 3. Money

- [ ] **Stripe, BizHaus.** Three accounts, one per legal entity (El Segundo,
  Marina del Rey, Costa Mesa) in one organisation. Joe is the account
  representative, so access survives. Remove Caroline when she leaves.
- [ ] **Stripe, Tucson.** `acct_1UQ9RtPmqanCGeIo`. Live since 2026-10-26.
  **Two-factor codes go to Joe's phone**, so nobody can administer this
  account without him. Worth adding a second admin with their own 2FA.
- [ ] **Intuit developer app (QuickBooks).** `QB_CLIENT_ID` starting
  `ABx9nZXS`. **Owner unconfirmed and this is the sharpest risk on the
  list.** If it sits on Caroline's personal Intuit login, every automatic
  sales receipt and payout deposit stops when her account goes, silently.
  Find out who owns it before Wednesday.

## 4. Email

- [ ] **Resend, BizHaus account.** Holds the verified `bizhaus.com` sending
  domain. Caroline's login. Invite the successor as a member.
- [ ] **Resend, Tucson account.** Holds `tucsontherapysuites.com`, verified
  2026-10-26. Confirm who owns it and add an owner.
- [ ] **Google Workspace.** Both domains route mail through Google
  (`aspmx.l.google.com`, `smtp.google.com`). Not Caroline's to transfer, but
  whoever administers it should be recorded.
- [ ] **`STAFF_NOTIFICATION_EMAIL`** is `hello@bizhaus.com` as of 2026-10-16.
  An `alerts@bizhaus.com` group would be better; see `HANDOFF.md` section 2.

## 5. Domains and DNS

- [ ] **GoDaddy.** `bizhaus.com`, `tucsontherapysuites.com` and
  `industrialforrent.com` all use GoDaddy nameservers. Confirm the successor
  has access. Everything breaks without it and nothing else on this list
  matters if the domains lapse.
- [ ] **Flywheel.** Hosts the bizhaus.com WordPress site. BizHaus owns the
  account, not Wise. Use Flywheel's WP-ADMIN button for real admin.

## 6. Everything else referenced in code

- [ ] **Pipedrive.** `PIPEDRIVE_API_TOKEN`, used by the member import to mark
  people as current members. Confirm the token is a company one, not personal.
- [ ] **Google reCAPTCHA.** `RECAPTCHA_SECRET_KEY` and site key, on Caroline's
  Google account. Move to a company Google account.
- [ ] **UptimeRobot.** Alerts if the site goes down. Caroline's login.
- [ ] **Google Ads.** Conversion tag lives in this codebase; tell whoever runs
  the ads account that it does.

---

## What does not need transferring

These were checked and are fine:

- Stripe BizHaus access, because Joe is already the account representative.
- The staging Supabase project and the staging GitHub repo, both already Joe's.
- The Tucson booking repo, already on Joe's GitHub.

---

## The test that actually proves it

Transferring is not the same as working. Before Wednesday, watch somebody
else, in front of you:

1. Deploy a change to one of the five sites.
2. Log in to Supabase and open a table.
3. Open the QuickBooks admin page in the portal.

If they cannot do all three without asking Caroline for anything, the
transfer is not finished, whatever the ticks above say.
