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
| **Vercel** | Hosts **five** production sites | `caroline-2678's projects`, a **personal** account on the paid Pro plan, confirmed 2026-10-16 | Move every project to a company-owned team. Billing is attached to whoever owns the account. See the note below. |
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

### The Vercel account, in detail

Checked 2026-10-16. **Five production projects sit on one personal account**,
`caroline-2678's projects`, on the paid Pro plan:

| Project | What it serves |
|---|---|
| `bizhaus` | The member portal, day passes, `/book` |
| `tucsontherapysuites` | The Tucson marketing site |
| `tucson-therapy-booking` | Tucson room bookings |
| `tucson-mail` | Tucson mail service |
| `industrialforrent` | Secura Way / M2 listings |

Nobody else can deploy them, read the logs, change an environment variable, or
see the bill. When that account goes, so does all five.

**Staging is not on this account**, and that is deliberate. Its code lives in
Joe's GitHub (`jtango777/member-portal`) and its database is Joe's Supabase
project (`bizhaus-staging`, org "BizHaus"). Whether a staging *Vercel* project
exists, and whose it is, was never recorded anywhere; if one exists it is
Joe's. Worth confirming rather than assuming.

**How to move them.** Each project moves separately: Project → Settings →
General → **Transfer Project**, to a company-owned Vercel team that somebody
else administers. Create the team first. Environment variables and custom
domains normally travel with the project, but check both afterwards and
redeploy, rather than assuming. The new team has its own billing, so the Pro
subscription on the personal account can then be cancelled.

**Do this before anything else.** Features can wait; losing access cannot be
undone from outside.

---

## 2. Alerts

The app emails `hello@bizhaus.com` when something fails that used to fail
silently: a QuickBooks receipt that could not be created, a payout that could
not be recorded, a refund that went through but whose booking did not update.

**Current value, set 2026-10-16: `hello@bizhaus.com`.**

For one day, 2026-10-15 to 2026-10-16, it was `caroline@bizhaus.com` only.
That was done during the QuickBooks payout debugging so repeated test runs
did not notify the whole team, and it was put back before she left, because
that address stops working when she goes.

**Still worth improving, but no longer urgent.** `hello@bizhaus.com` is the
whole team inbox, so everyone now sees plumbing failures that only a
developer can act on: a QuickBooks receipt that did not post, a payout that
did not record. The better end state is an `alerts@bizhaus.com` Google group
holding whoever actually maintains the app. Ask Joe to create it and set
`STAFF_NOTIFICATION_EMAIL` in Vercel to it.

The variable accepts a comma separated list (`lib/email.ts` splits on
commas), so it can hold several people. Set it in the Vercel `bizhaus`
project under Production and Preview, then redeploy or it keeps the old
value. Do **not** mark it as a Secret: Vercel makes secrets write-only, so
nobody can read or edit the value afterwards, and it has to be deleted and
recreated. That is what happened to it on 2026-10-16.

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
  password resets an hour, and its deliverability is poor. Swapping it to
  Resend SMTP under Authentication → Emails → SMTP Settings lifts both. Not a
  known cause of any real failure yet, but the next one to do.
- **Someone can be a day pass customer and a member at the same time, and the
  two halves do not know much about each other.** One login now covers both
  (see below), but their name, phone and company are stored separately in
  `booking_customers` and `profiles`, and nothing keeps them in step.
- **Nine admin screens render times in the viewer's timezone**, which is
  correct in California and wrong anywhere else.
- **Conference room booking is built and tested but hidden**, behind
  `ROOM_BOOKING_LAUNCHED` in `app/my-bookings/page.tsx`.

---

## 6a. Fixed on 2026-10-16, worth knowing about

Four dead ends, all of which looked like the app working and were not. Written
down because the shapes repeat.

**Archiving somebody never removed their login.** Adding an archived person
back updated the archived row in place and left it archived. The admin saw
"invite sent", the person got an email, clicked it, and was told their account
already existed. Nothing anywhere mentioned the archive. Adding someone who is
archived now **restores them** instead. If they had already finished setting
up, no invite is sent, because their old password still works and there is
nothing to invite them to.

**A day pass customer could never become a member.** Accepting an invite always
tried to create a brand new login, so anyone who already had one, which every
day pass buyer does, hit the collision and got "Account setup failed. Please
try again." Two real people were stuck this way. Both accept routes now attach
the member portal to the login that already exists.

> The two routes prove identity differently, and that difference is
> deliberate. `/api/invites/accept` has a token that was emailed to that
> address and nowhere else, which is the same proof a password reset runs on,
> so it may set the password. `/api/invites/accept-by-email`, reached from the
> public `/register` page, has no token, so it asks for the password they
> already have. Without that check anyone who knew a member's email address
> could have taken their account over. Do not "simplify" these into one.

**Forgot password did nothing for someone who had never set up.** A reset only
works on a login that exists. Supabase deliberately answers "fine" to an
address it does not recognise, so nobody can use that form to discover who has
an account, and the page printed "check your email". A real member sat locked
out while the page told her mail was on its way. Forgot password now works out
which of the two things the person needs: a reset if they have a login, their
**invite** if they are on the member list and never finished, and the same
generic wording as a reset if neither, so it still cannot be used to find out
who is a member.

**reCAPTCHA made these flows untestable.** There is no way to click an "I'm not
a robot" box from a test script, so signup paths were only ever checked by
hand. `lib/recaptchaDisabled.ts` now turns it off for local `next dev`, and for
staging when `NEXT_PUBLIC_DISABLE_RECAPTCHA=1` is set there. Two locks on
purpose: the switch alone would silence the check on anything that inherited
the variable, and `isStaging` alone would silence it on anything whose URL
happened to say "staging". **Production satisfies neither, and must never.**

Staging can also be run locally now: `npm run dev:staging` serves on port 3001
against the staging database, with a banner on every page so it is obvious
which one you are looking at.

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
