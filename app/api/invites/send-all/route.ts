import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInviteEmailsBatch } from '@/lib/email'
import { generateToken } from '@/lib/utils'

// Plenty for one batch of up to 100 — a single Resend API call plus a
// handful of database writes — but explicit so a slow moment doesn't get
// cut off at the platform's shorter default.
export const maxDuration = 60

// Resend's batch endpoint caps at 100 emails per call.
const BATCH_SIZE = 100

// Simple sanity check — catches the malformed "a@x.com, b@y.com" style
// records found 2026-09-14 before they poison a whole batch (Resend's
// batch endpoint rejects the entire call if any single address is invalid).
const VALID_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

// Sends the NEXT batch of invites (up to 100), not everyone at once.
// Rewritten 2026-09-14 before the first mass send. The old version:
//   - fired 10 emails in parallel at a time, well past Resend's per-second
//     rate limit, so most would have been rejected;
//   - counted a rejected email as "sent" (the send function never reported
//     failure);
//   - saved each person's invite token BEFORE sending, so a failed email
//     still marked them "Invited" — and Invite All skips anyone already
//     invited, so a retry would never reach them;
//   - ran all ~530 people in one request, which could time out partway.
// Now: one Resend batch call per click, tokens saved first and rolled back
// if that call fails, so nobody is ever marked invited without an email.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()

  // Everyone never invited (no token, not accepted) and still active.
  // The is_active check keeps archived pending invites out. Caught 2026-09-11.
  const { data: candidates, error } = await admin
    .from('permitted_emails')
    .select('id, email, invited_at')
    .is('accepted_at', null)
    .is('invite_token', null)
    .eq('is_active', true)
    .order('email')
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[invites/send-all] load error:', error.message)
    return NextResponse.json({ error: 'Failed to load uninvited members.' }, { status: 500 })
  }
  if (!candidates?.length) return NextResponse.json({ sent: 0, skipped: [], remaining: 0 })

  const valid = candidates.filter(c => VALID_EMAIL.test(c.email.trim()))
  const skipped = candidates
    .filter(c => !VALID_EMAIL.test(c.email.trim()))
    .map(c => ({ email: c.email, reason: 'Invalid email address' }))

  // Invalid addresses stay un-invited, so without this they'd sit at the
  // front of the queue and block every future batch from moving forward.
  // They're reported back so an admin can fix them.
  if (valid.length === 0) {
    const remaining = await countRemaining(admin)
    return NextResponse.json({ sent: 0, skipped, remaining, error: 'Every address in this batch is invalid — fix them in Members, then try again.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const invites = valid.map(c => ({ id: c.id, email: c.email.trim(), token: generateToken(), originalInvitedAt: c.invited_at }))

  // 1. Save tokens first, so the link in each email works the moment it lands.
  const writeResults = await inChunks(invites, 20, inv =>
    admin.from('permitted_emails').update({ invite_token: inv.token, invited_at: now }).eq('id', inv.id)
  )
  const writeFailed = writeResults.some(r => r.error)
  if (writeFailed) {
    await rollback(admin, invites)
    console.error('[invites/send-all] token write failed; rolled back')
    return NextResponse.json({ error: 'Could not prepare invites. Nothing was sent.' }, { status: 500 })
  }

  // 2. Send the whole batch in one call — all or nothing.
  const result = await sendInviteEmailsBatch(invites.map(i => ({ to: i.email, token: i.token })))

  // 3. If it failed, undo the tokens so these people stay un-invited and
  //    the next click retries them.
  if (!result.ok) {
    await rollback(admin, invites)
    const remaining = await countRemaining(admin)
    return NextResponse.json({ sent: 0, skipped, remaining, error: `Email service rejected the batch: ${result.error}. Nothing was sent; nobody was marked invited.` }, { status: 502 })
  }

  const remaining = await countRemaining(admin)
  return NextResponse.json({ sent: invites.length, skipped, remaining })
}

type Admin = ReturnType<typeof createAdminClient>

async function countRemaining(admin: Admin) {
  const { count } = await admin
    .from('permitted_emails')
    .select('id', { count: 'exact', head: true })
    .is('accepted_at', null)
    .is('invite_token', null)
    .eq('is_active', true)
  return count ?? 0
}

async function rollback(admin: Admin, invites: { id: string; token: string; originalInvitedAt: string | null }[]) {
  // Only clears rows still holding the token this request wrote, so it
  // can't wipe an invite some other action created in the meantime. Also
  // restores the original date, which the Not Invited list shows as "Added."
  await inChunks(invites, 20, inv =>
    admin.from('permitted_emails').update({ invite_token: null, invited_at: inv.originalInvitedAt }).eq('id', inv.id).eq('invite_token', inv.token)
  )
}

async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => PromiseLike<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)))
  }
  return out
}
