# BizHaus Room Booking — Handoff Document

Everything is built and deployed. This document explains what exists, what accounts matter, and what to do day-to-day.

---

## What Was Built

A private room reservation system for BizHaus members at all 3 locations (El Segundo, Marina del Rey, Costa Mesa). It replaces GetaRoom.

Members get invited by email, set up an account, and can book rooms from a day-view calendar. Companies get a monthly hour allotment. Admins can manage everything.

---

## The Live App

**URL:** https://members.bizhaus.com  
**Login:** Your admin email + password

---

## Accounts You Need Access To

These are all cloud-based — no software to install unless you want to make code changes.

| Platform | What It Does | URL |
|---|---|---|
| **Vercel** | Hosts the live website | vercel.com |
| **GitHub** | Stores the code, triggers deploys | github.com/carolinebizhaus/bizhaus |
| **Supabase** | The database (members, companies, reservations) | supabase.com |
| **Resend** | Sends invite/confirmation/cancellation emails | resend.com |
| **GoDaddy** | Controls the bizhaus.com domain and DNS | godaddy.com |
| **UptimeRobot** | Alerts you if the site goes down | uptimerobot.com |

Ask Caroline for login details for each.

---

## What's Still Pending Before Full Launch

- [x] **GoDaddy DNS** — Done. Domain verified in Resend on Jun 4. Emails now send from `bookings@bizhaus.com`
- [ ] **Test everything** — Send a test invite, make a reservation, cancel one — confirm all 3 emails arrive correctly
- [ ] **Send invites** to all members via Admin → Members → Invite Uninvited button
- [ ] **Cancel GetaRoom**

---

## Day-to-Day Admin Tasks

Everything is done through the web app at members.bizhaus.com. No coding required.

**Managing members:**
- Add a new member: Admin → Members → Add Member → enter email → Send Invite
- They get an email with a link to set up their account
- Invite everyone who hasn't been invited yet: Admin → Members → **Invite Uninvited** button (shows count — safe to run anytime, only sends to people who haven't received an invite)
- Resend an invite: Admin → Members → Resend button
- Remove a member: Admin → Members → Remove

**Managing companies:**
- Add a company: Admin → Companies → Add Company
- Change a company's monthly hour allotment: Admin → Companies → Edit

**Managing reservations:**
- View all bookings: Admin → All Reservations
- Delete a booking: click it on the calendar → Delete
- Create a booking on behalf of someone: click any time slot on the calendar

**Reports:**
- Admin → Reports — export reservation lists, company usage, room utilization by month
- Admin → Time Usage — see hours used vs allotment per company, current month

---

## If You Need to Make Code Changes

This requires a one-time local setup on your computer:

1. Install Node.js from https://nodejs.org (version 18 or later)
2. Install Claude Code (used to make changes via AI)
3. Clone the repo from GitHub to your Desktop
4. Run `npm install` in the project folder
5. Copy `.env.local.example` to `.env.local` and fill in the keys (get these from Supabase + Resend dashboards)
6. Run `npm run dev` to start the app locally at http://localhost:3000

Then use Claude Code to describe what you want changed — it edits the code, you push to GitHub, Vercel deploys automatically.

---

## How Deploys Work

1. Code lives on GitHub (github.com/carolinebizhaus/bizhaus)
2. Vercel watches that GitHub repo
3. Any push to the `main` branch → Vercel automatically rebuilds and deploys in ~30 seconds
4. No manual steps needed on Vercel after the initial setup

---

## Environment Variables (Secret Keys)

All stored in Vercel under Settings → Environment Variables. Never put these in the code.

| Variable | What It Is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key (keep secret) |
| `RESEND_API_KEY` | Resend email API key |
| `RESEND_FROM_EMAIL` | `BizHaus Bookings <bookings@bizhaus.com>` |
| `NEXT_PUBLIC_APP_URL` | `https://members.bizhaus.com` |

---

## Upcoming Phases

**Phase 2 — Membership Types** *(not yet started)*  
Define membership tiers with automatic hour allotments instead of setting hours manually per company.

**Phase 3 — External Booking** *(not yet started)*  
A separate public-facing interface for external parties to book rooms, with payment integration (QuickBooks) and a no-cancellation policy for external users.
