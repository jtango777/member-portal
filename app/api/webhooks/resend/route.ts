import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Resend calls this whenever an email we sent bounces or gets marked as
// spam, and we flag that address on its permitted_emails row so it shows
// up on the Members page. Before this (added 2026-09-14), the portal handed
// emails to Resend and never heard back — a bounced invite still read as
// "Invited" with no way to tell it never arrived.
//
// Set up in Resend → Webhooks, pointing at /api/webhooks/resend, subscribed
// to email.bounced and email.complained. Its signing secret goes in the
// RESEND_WEBHOOK_SECRET env var.

// Reject anything signed more than 5 minutes ago, so a captured request
// can't be replayed later.
const TOLERANCE_SECONDS = 5 * 60

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/resend] RESEND_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  // Must be the raw body, byte for byte — the signature is computed over it.
  const rawBody = await request.text()
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signatureHeader = request.headers.get('svix-signature')

  if (!id || !timestamp || !signatureHeader || !isValidSignature(secret, id, timestamp, rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: ResendEvent
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = event.type === 'email.bounced' ? 'bounced'
    : event.type === 'email.complained' ? 'complained'
    : null
  // Anything else (delivered, opened, etc.) is acknowledged and ignored, so
  // subscribing to extra events in Resend later can't break anything.
  if (!status) return NextResponse.json({ ok: true, ignored: event.type })

  const recipients = (Array.isArray(event.data?.to) ? event.data.to : [event.data?.to])
    .filter((v): v is string => typeof v === 'string')
    .map(extractAddress)
    .filter(Boolean)

  const reason = status === 'bounced'
    ? (event.data?.bounce?.message || event.data?.bounce?.subType || event.data?.bounce?.type || 'Email bounced')
    : 'Marked as spam by the recipient'

  const admin = createAdminClient()
  for (const email of recipients) {
    const { error } = await admin
      .from('permitted_emails')
      .update({ email_status: status, email_status_reason: reason, email_status_at: event.created_at ?? new Date().toISOString() })
      .eq('email', email)
    if (error) {
      console.error('[webhooks/resend] update failed for', email, error.message)
      // Non-2xx makes Resend retry later instead of dropping the event.
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

type ResendEvent = {
  type: string
  created_at?: string
  data?: {
    to?: string[] | string
    bounce?: { message?: string; type?: string; subType?: string }
  }
}

// "Name <person@x.com>" → "person@x.com", lowercased to match how every
// permitted_emails address is stored.
function extractAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim().toLowerCase()
}

// Resend signs webhooks the Svix way: HMAC-SHA256 over
// "{id}.{timestamp}.{body}", keyed with the base64 part of the whsec_ secret.
// The header can carry several space-separated "v1,<signature>" entries
// (during a secret rotation), and any one matching is valid.
function isValidSignature(secret: string, id: string, timestamp: string, body: string, header: string): boolean {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) return false

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret, 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()

  return header.split(' ').some(part => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && crypto.timingSafeEqual(given, expected)
  })
}
