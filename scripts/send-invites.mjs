#!/usr/bin/env node
/**
 * BizHaus — Bulk Invite Sender
 *
 * Sends invite emails to users who are in permitted_emails but have not yet
 * received an invite (invite_token IS NULL) and have not accepted (accepted_at IS NULL).
 *
 * Usage:
 *   node scripts/send-invites.mjs               # send all pending invites
 *   node scripts/send-invites.mjs --limit 50    # send at most 50 emails
 *   node scripts/send-invites.mjs --dry-run     # preview without sending
 *
 * Resend free tier: 100 emails/day. Use --limit to stay within your plan.
 * Paid tier (Resend): no practical daily limit.
 */

import { readFileSync, existsSync } from 'fs'
import { createClient }             from '@supabase/supabase-js'
import { Resend }                   from 'resend'
import { fileURLToPath }            from 'url'
import { dirname, join }            from 'path'
import { randomUUID }               from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = process.argv.includes('--dry-run')

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌  .env.local not found.')
    process.exit(1)
  }
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

function inviteHtml(link) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#0f172a;">Welcome to BizHaus</h2>
      <p>You've been invited to the BizHaus room reservation system.</p>
      <p>Click the link below to set up your account — it only takes a minute.</p>
      <a href="${link}"
         style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;
                border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;">
        Set Up My Account
      </a>
      <p style="color:#64748b;font-size:14px;">
        This link expires in 7 days. If you weren't expecting this invite, you can ignore it.
      </p>
    </div>
  `
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv()

  const url       = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key       = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const from      = process.env.RESEND_FROM_EMAIL  ?? 'BizHaus <noreply@bizhaus.com>'

  if (!url || !key) {
    console.error('❌  Missing Supabase env vars in .env.local')
    process.exit(1)
  }
  if (!resendKey || resendKey === 're_your_key') {
    console.error('❌  RESEND_API_KEY is not set in .env.local')
    process.exit(1)
  }

  // Parse --limit N
  const limitIdx = process.argv.indexOf('--limit')
  const limit    = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity
  if (limitIdx !== -1 && isNaN(limit)) {
    console.error('❌  --limit must be followed by a number, e.g. --limit 50')
    process.exit(1)
  }

  const db     = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const resend = new Resend(resendKey)

  // Fetch users who need an invite: not yet accepted AND not yet sent a token
  const { data: pending, error } = await db
    .from('permitted_emails')
    .select('id, email')
    .is('accepted_at', null)
    .is('invite_token', null)
    .order('invited_at', { ascending: true })

  if (error) { console.error('❌  Database error:', error.message); process.exit(1) }

  const toSend = (pending ?? []).slice(0, isFinite(limit) ? limit : undefined)

  console.log(`\n✉️   BizHaus bulk invite${DRY_RUN ? '  [DRY RUN]' : ''}`)
  console.log(`    Pending (no invite sent): ${pending?.length ?? 0}`)
  console.log(`    Will send this run:       ${toSend.length}`)
  if (isFinite(limit)) console.log(`    Limit applied:            ${limit}`)
  console.log()

  if (toSend.length === 0) {
    console.log('Nothing to send. All permitted users have already been invited.')
    return
  }

  let sent = 0, failed = 0

  for (const user of toSend) {
    const token = randomUUID()
    const link  = `${appUrl}/setup-account?token=${token}`

    if (DRY_RUN) {
      console.log(`  [dry] Would invite: ${user.email}`)
      sent++
      continue
    }

    // Save token before sending — if email fails, token is still set (safe to retry)
    const { error: updateErr } = await db
      .from('permitted_emails')
      .update({ invite_token: token, invited_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateErr) {
      console.error(`  ✗ ${user.email} (token save failed): ${updateErr.message}`)
      failed++
      continue
    }

    try {
      await resend.emails.send({
        from,
        to:      user.email,
        subject: "You're invited to BizHaus",
        html:    inviteHtml(link),
      })
      console.log(`  ✓ ${user.email}`)
      sent++
    } catch (e) {
      console.error(`  ✗ ${user.email}: ${e.message}`)
      failed++
    }

    // ~120 ms gap → ~8 req/s, well within Resend's rate limit
    await sleep(120)
  }

  const remaining = (pending?.length ?? 0) - toSend.length
  console.log(`\n✅  Done.  Sent: ${sent}  |  Failed: ${failed}`)
  if (remaining > 0) {
    console.log(`\n    ${remaining} users still waiting. Run again to continue:`)
    console.log(`    node scripts/send-invites.mjs --limit ${Math.min(100, remaining)}`)
  }
  console.log()
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
