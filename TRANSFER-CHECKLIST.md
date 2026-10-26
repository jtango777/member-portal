# Transfer checklist

Caroline's last day is **Wednesday 2026-10-28**. Work down this page in order.

Built from the code on 2026-10-26: every environment variable and every
outbound hostname across all five production repositories, so nothing here is
from memory.

---

## Step 1 — Send Joe this, now

Seven items below cannot be decided without his answer.

> Joe, before Wednesday I need to know which of these you can already log
> into, so I only hand over the ones you can't. Just try each and tell me yes
> or no, you don't need to change anything.
>
> 1. Vercel (hosts all five websites)
> 2. Supabase — BizHaus member database
> 3. Supabase — Tucson booking database
> 4. Supabase — Tucson mail database
> 5. Resend — BizHaus email account
> 6. Resend — Tucson email account
> 7. Intuit / QuickBooks developer app
> 8. Google reCAPTCHA
> 9. UptimeRobot

- [ ] Sent

---

## Step 2 — The two that bite

### Intuit / QuickBooks

**Why it matters:** if this app sits on Caroline's personal Intuit login,
every automatic sales receipt and payout deposit stops the day her account
goes, and stops **silently**. This is the bookkeeping for three legal
entities.

- [ ] Open developer.intuit.com, find the app whose client ID starts
      `ABx9nZXS`, and see whose account it belongs to
- [ ] If it is Caroline's personal login: add Joe, or recreate the app under a
      company Intuit account and update `QB_CLIENT_ID` / `QB_CLIENT_SECRET` in
      Vercel

### Vercel

**Why it matters:** five live sites, one personal account. Nobody else can
change an environment variable, rotate a key, or see the bill. Joe can still
ship code, because he pushes to GitHub and Vercel builds automatically.

- [ ] Get a name, an email and a company card from Joe
- [ ] Create a company Vercel team
- [ ] Transfer each project: Settings → General → **Transfer Project**
      - [ ] `bizhaus`
      - [ ] `tucsontherapysuites`
      - [ ] `tucson-therapy-booking`
      - [ ] `tucson-mail`
      - [ ] `industrialforrent`
- [ ] Check environment variables and domains survived each move, then redeploy

---

## Step 3 — Once Joe answers

Tick the ones he can already reach. For each **no**, do the action.

| # | Service | What it holds | If he says no |
|---|---|---|---|
| 1 | Supabase, BizHaus production | members, companies, bookings | Add him as owner |
| 2 | Supabase, Tucson booking | room bookings | Add him as owner |
| 3 | Supabase, Tucson mail | mail members, suites | Add him as owner |
| 4 | Resend, BizHaus | sends every member + booking email | Invite as member |
| 5 | Resend, Tucson | sends every Tucson email | Invite as member |
| 6 | Google reCAPTCHA | spam protection on booking forms | Move to a company Google account |
| 7 | UptimeRobot | alert when a site goes down | Invite or move |

- [ ] 1  - [ ] 2  - [ ] 3  - [ ] 4  - [ ] 5  - [ ] 6  - [ ] 7

---

## Step 4 — GitHub

Joe already commits to `carolinebizhaus/portal`, so he has that one. The other
three are unchecked.

- [ ] `carolinebizhaus/TucsonTherapySuites`
- [ ] `carolinebizhaus/tucsonmailservice`
- [ ] `carolinebizhaus/industrialforrent`

Either transfer them to an organisation, or add Joe as a collaborator on each.
`joetherapy/tucsontherapybooking` is already his.

---

## Step 5 — Last, once Joe has tested

- [ ] Add the Book Now link to tucsontherapysuites.com
- [ ] Add the /book link to bizhaus.com (WordPress, via Flywheel's WP-ADMIN)

Both products are live, tested and taking real payments. They are reachable
from nowhere until these links exist.

---

## Already confirmed, nothing to do

| Service | Status |
|---|---|
| GoDaddy (all three domains) | Joe has access, 2026-10-26 |
| Flywheel (bizhaus.com WordPress) | Joe has access, 2026-10-26 |
| Pipedrive | Joe has access. Low risk anyway: a dead token logs an error, the invite still sends |
| Stripe, BizHaus | Joe is the account representative, access survives. Remove Caroline when she goes |
| Stripe, Tucson | 2FA goes to Joe's phone, which is the right end state |
| Supabase staging | Already on Joe's account |
| Vercel Blob (Secura Way images) | Belongs to the `industrialforrent` project, moves with it |
| Google Workspace | Not Caroline's to transfer |
| Google Ads | Nothing to move. Tell whoever runs it that the conversion tag lives in this codebase |

---

## The test that proves it worked

Transferring is not the same as working. Before Wednesday, watch someone
else, sitting in front of you, do all three:

- [ ] Deploy a change to one of the five sites
- [ ] Log in to Supabase and open a table
- [ ] Open the QuickBooks admin page in the portal

If they need to ask Caroline for anything, it is not finished, whatever is
ticked above.
