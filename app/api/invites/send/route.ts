import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInviteEmail } from '@/lib/email'
import { generateToken } from '@/lib/utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { email, company_id } = await request.json()
  if (!email || !company_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const admin = createAdminClient()
  const token = generateToken()

  const { error } = await admin.from('permitted_emails').upsert(
    { email: email.toLowerCase().trim(), company_id, invite_token: token, invited_at: new Date().toISOString(), accepted_at: null },
    { onConflict: 'email' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${appUrl}/setup-account?token=${token}`
  let emailSent = false

  try {
    await sendInviteEmail(email, token)
    emailSent = true
  } catch (_) {
    // Email failure doesn't block the invite — admin can copy the link manually
  }

  return NextResponse.json({ ok: true, inviteLink, emailSent })
}
