# BizHaus Portal — Handoff

Last updated 2026-10-13. Replaces the July version, which described the app
before day passes, conference room booking, the per-entity Stripe split and
the QuickBooks automation existed.

Two sites, one codebase:

- **members.bizhaus.com** — the member portal and all admin screens
- **bookings.bizhaus.com** — what customers use: day passes, conference room
  booking, and My Bookings

`bizhaus.com` itself is a separate WordPress site on Flywheel and is not part
of this.

---

## 1. Accounts to transfer

This is the part most likely to be left undone, and the part that hurts most
if it is. Several of these are in Caroline's personal name, not the company's.

| Service | What it does | Who owns it now | What needs to happen |
|---|---|---|---|
| **Vercel** | Hosts both sites | `caroline-2678's projects`, a **personal** account, paid plan | Move the `bizhaus` project to a company-owned team, or transfer the account. Billing is attached to whoever owns it. |
| **GitHub** | The code | `carolinebizhaus/portal` (production) and `jtango777/member-portal` (staging, Joe's) | Transfer `carolinebizhaus/portal` to a company account or add owners. Losing this loses the ability to deploy. |
| **Supabase** | The database: members, companies, bookings, customers | Caroline's login | Add the successor as an owner on both the production and staging projects. |
| **Resend** | Sends every customer email | Caroline's login | Add the successor. Also holds the verified `bizhaus.com` sending domain. |
| **Stripe** | Three accounts, one per entity, inside one organization | Joe is the account representative; Caroline is Super Administrator | **Already fine.** Joe keeps access when Caroline leaves. Just remove her when the time comes. |
| **Intuit developer** | The QuickBooks connection | Whoever created the app (`QB_CLIENT_ID` starts `ABx9nZXS`) | Confirm who owns this. If it is Caroline's personal Intuit login, the QuickBooks sync dies with it. |
| **GoDaddy** | `bizhaus.com` domain and DNS | Company | Confirm the successor has access. Everything breaks without it. |
| **Google reCAPTCHA** | Spam protection on the booking forms | Caroline's Google account | Move to a company Google account. |
| **Google Ads** | Conversion tracking on the booking site | Chris / the ads account | Nothing to move, but tell whoever runs it that the tag lives in this codebase. |
| **Pipedrive** | An API token used for member imports | Company CRM | Confirm the token is not personal. |
| **UptimeRobot** | Alerts if the site goes down | Caroline's login | Add the successor or move it. |

**Do this before anything else.** Features can wait; losing access cannot be
undone from outside.

---

## 2. Alerts

The app emails `hello@bizhaus.com` when something fails that used to fail
silently: a QuickBooks receipt that could not be created, a payout that could
not be recorded, a refund that went through but whose booking did not update.

**As of 2026-10-15 these go to Caroline's address only**, not to
`hello@bizhaus.com`. Changed during the QuickBooks payout debugging so that
repeated test runs did not notify the whole team, and deliberately left that
way: she is the only person who can currently act on one.

**This must be changed before she leaves**, or the alerts go to an inbox
nobody is reading. Ask Joe to create `alerts@bizhaus.com` as a Google group
and set `STAFF_NOTIFICATION_EMAIL` in Vercel to it. The variable accepts a
comma separated list, so it can hold a couple of people in the meantime.
The previous value was `hello@bizhaus.com`; do not simply restore that,
nobody on it can act on these.

---

## 3. How the money works

Worth understanding, because it is the part with real consequences.

**Three legal entities, three Stripe accounts.** El Segundo (BizHaus 1730
Holly, LP), Marina del Rey and Costa Mesa each have their own Stripe account
with its own EIN and bank account. The app picks the right one from the
location on the booking. El Segundo keeps the original unsuffixed environment
variables; the other two are suffixed `_MARINA` and `_COSTA_MESA`.

**Payments taken before 2026-10-06 are all on the El Segundo account**,
whatever location they were for. Refunds on those fall back to it
automatically. Do not "tidy" that fallback away.

**Each sale writes itself into that entity's QuickBooks** as a sales receipt,
against the right customer and the right product line. Product names differ
per company and come from the `locations` table.

**When Stripe pays out, the app records a deposit in QuickBooks** containing
the sales it covers and a negative line for Stripe's fee, so the books match
the bank without anyone reconciling by hand. The bank account each entity
deposits into is set in **Admin → QuickBooks**.

**Cancellations** refund or hold credit, email the customer, and void the
QuickBooks receipt when refunded.

---

## 4. Day to day

Everything below is in the admin area at members.bizhaus.com.

- **Day Passes** — every purchase, searchable, split into Upcoming, Past and
  Cancelled. Price and closure days are set here. Staff can cancel any booking
  with or without a refund.
- **Conference Rooms** — internal member reservations and external paid
  bookings, with the same cancel control.
- **People → Members / Companies / Customers** — Members pay monthly,
  Customers buy one-offs. Plenty of people are both.
- **Email Templates** — the wording of every customer email, editable, with a
  live preview of the real email beside it.
- **QuickBooks** — connection status per location, and the payout bank
  account per location.
- **Reports, Time Usage, Page Activity** — usage and revenue.

---

## 5. Deploys

`develop` is the working branch. Pushing runs:

```
git push staging HEAD:main      # staging.bizhaus.com
git push origin develop:main    # production
git push origin develop
```

**Deploys are gated on the typechecker.** A build that does not compile is
refused rather than shipped. Run `npm run typecheck` before pushing. This was
turned on after a one-word mistake broke account creation for every new
customer for two hours.

ESLint works (`npm run lint`) but is not gating, because it reports a couple
of hundred style complaints that are not correctness problems.

---

## 6. Known gaps

Honest list. None are on fire, all will surprise someone eventually.

- **No tests on the money or email paths.** Two bugs reached customers that a
  handful of tests would have caught: an amount rounded to the wrong figure,
  and emails showing UTC instead of Pacific time. This is the biggest piece of
  missing safety net.
- **Signed-in day pass buyers are never asked for a phone number**, even
  though it is required for everyone else. Existing customers have none on
  file and nothing backfills it.
- **The conference room tables on bizhaus.com are stale**, including Marina's
  old address. That site is edited separately, in WordPress.
- **The day pass price on bizhaus.com is typed into the theme by hand** and
  does not follow the price set in admin. Changing one means changing both.
- **Email sending is rate limited** by Supabase's built-in sender, roughly two
  password resets an hour. Swapping it to Resend SMTP lifts that.
- **Nine admin screens render times in the viewer's timezone**, which is
  correct in California and wrong anywhere else.
- **Conference room booking is built and tested but hidden**, behind
  `ROOM_BOOKING_LAUNCHED` in `app/my-bookings/page.tsx`.

---

## 7. Things that have bitten before

Written down so nobody rediscovers them the hard way.

- **Never format a timestamp with date-fns on the server.** Vercel runs UTC
  and it has emailed customers the wrong time twice. Use the Pacific helpers
  in `lib/utils.ts`.
- **El Segundo's Medium and Medium+ room photos look swapped.** They are not;
  the filenames are wrong. There is a comment saying so. Leave them.
- **Local `.env.local` points at different Stripe and Intuit accounts than
  production.** Do not run scripts against production QuickBooks or Stripe
  from a laptop. Doing so once marked all three QuickBooks locations as
  disconnected and had to be undone by hand.
- **The project folder lives in iCloud**, which occasionally creates duplicate
  files like `routes.d 2.ts` inside the build folder and confuses the
  typechecker. Deleting them is safe.
