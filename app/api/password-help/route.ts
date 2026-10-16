import { createAdminClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendInviteEmail } from '@/lib/email'
import { generateToken } from '@/lib/utils'
import { findAuthUserByEmail } from '@/lib/authLookup'

// "Forgot password" for someone who has never set up an account.
//
// A reset only works on a login that already exists. Someone who was
// invited and never clicked the link has no login, so the reset has nothing
// to act on — and Supabase deliberately answers "fine" to an address it does
// not recognise, so that form cannot be used to discover who has an account.
// The page took that as success and said "check your email". Nothing was
// ever sent.
//
// That is what happened to Irina Slavina: invited, never finished setting
// up, and Chris reached for Forgot password instead of Resend invite. The
// two look like the same thing from outside and are not. She sat locked out
// with a page telling her mail was on its way (Caroline, 2026-10-16).
//
// So: work out which of the two this person actually needs, and do that one.

// Stops this being a way to fire invite emails at a member over and over.
const RESEND_COOLDOWN_MS = 5 * 60 * 1000

export async function POST(request: Request) {
  const { email: rawEmail, redirectTo } = await request.json()
  const email = (rawEmail ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

  const admin = createAdminClient()

  // They have a login: an ordinary password reset, which is what they asked
  // for. Sent with the anon key so Supabase applies its usual rate limits.
  const existingLogin = await findAuthUserByEmail(admin, email)
  if (existingLogin) {
    const anon = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) {
      console.error('[password-help] reset error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ status: 'reset_sent' })
  }

  // No login. If they are on the member list and never finished setting up,
  // an invite is the thing that actually helps them.
  const { data: invite } = await admin
    .from('permitted_emails')
    .select('id, email, invited_at, invite_token, accepted_at, is_active')
    .eq('email', email)
    .maybeSingle()

  if (invite && !invite.accepted_at && invite.is_active !== false) {
    const lastSent = invite.invited_at ? new Date(invite.invited_at).getTime() : 0
    const withinCooldown = Date.now() - lastSent < RESEND_COOLDOWN_MS

    if (!withinCooldown) {
      const token = invite.invite_token ?? generateToken()
      await admin
        .from('permitted_emails')
        .update({ invite_token: token, invited_at: new Date().toISOString(), email_status: null, email_status_reason: null, email_status_at: null })
        .eq('id', invite.id)
      try {
        await sendInviteEmail(invite.email, token)
      } catch (err) {
        console.error('[password-help] invite send failed:', err)
      }
    }
    // Reported either way: one just went out, or one went out minutes ago
    // and is sitting in their inbox. Both mean "go and look for the invite".
    return NextResponse.json({ status: 'invite_sent' })
  }

  // Not a member and no login. Say the same thing a successful reset says,
  // so this route cannot be used to find out who is on the member list.
  return NextResponse.json({ status: 'reset_sent' })
}
