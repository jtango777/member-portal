# BizHaus Setup Guide

## Prerequisites

Install Node.js (version 18 or later): https://nodejs.org/

## 1 — Install dependencies

Open Terminal, navigate to this folder, and run:

```
npm install
```

## 2 — Create a Supabase project

1. Go to https://supabase.com and sign up / sign in
2. Click "New project", give it a name (e.g. "BizHaus"), choose a password, pick a region close to you
3. Wait for the project to be ready (about 1 minute)

## 3 — Set up the database

1. In your Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file `supabase/migrations/001_schema.sql` from this folder
4. Paste the entire contents into the SQL editor
5. Click "Run" — you should see "Success"

This creates all the tables and seeds the locations and rooms.

## 4 — Configure environment variables

1. Copy `.env.local.example` to a new file named `.env.local`
2. In your Supabase dashboard, go to Settings > API
3. Copy the values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep this secret, never share it
4. Sign up at https://resend.com and get an API key → `RESEND_API_KEY`
5. Verify your sending domain in Resend and set the "From" address → `RESEND_FROM_EMAIL`
6. Set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000` for local development

## 5 — Create the first admin account

1. Start the app: `npm run dev`
2. Open http://localhost:3000/admin-setup in your browser
3. Fill in your name, email, password, and a company name for BizHaus staff (e.g. "BizHaus Staff")
4. Click "Create Admin Account"
5. Sign in at http://localhost:3000/login

That page will be locked out permanently once the first admin is created.

## 6 — Add members

1. Sign in as admin
2. Go to Admin → Companies — create a company for each member group
3. Go to Admin → Members — click "Add Member", enter their email, assign a company, send invite
4. The member receives an email with a link to set up their account

## Running in production

Deploy to Vercel (free tier works great):
1. Push this folder to a GitHub repository
2. Connect the repo to Vercel at https://vercel.com
3. Add all the environment variables from `.env.local` in Vercel's project settings
4. Change `NEXT_PUBLIC_APP_URL` to your production URL (e.g. https://bizhaus.vercel.app)
5. Deploy

## Day-to-day admin tasks

- **Add a new member**: Admin → Members → Add Member
- **Create a company**: Admin → Companies → Add Company
- **Change hour allotment**: Admin → Companies → Edit (pencil icon)
- **View time usage**: Admin → Time Usage
- **Delete a booking**: Click the booking on the calendar → Delete (admin only)
