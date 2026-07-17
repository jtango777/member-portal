import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, name, password, default_location_id, seating } = await request.json()

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('permitted_emails')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!invite || invite.accepted_at) {
    return NextResponse.json({ error: 'This email is not recognized, or already has an account.' }, { status: 400 })
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         invite.email,
    password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    console.error('[invites/accept-by-email] Auth create error:', authError.message)
    return NextResponse.json({ error: 'Account setup failed. Please try again.' }, { status: 500 })
  }

  const userId = authData.user!.id

  await admin.from('profiles').insert({
    id:                  userId,
    company_id:          invite.company_id,
    full_name:           name.trim(),
    is_admin:            false,
    default_location_id: default_location_id ?? null,
    avatar_url:          invite.avatar_url ?? null,
    seating:             seating ?? null,
  })

  await admin
    .from('permitted_emails')
    .update({ accepted_at: new Date().toISOString(), invite_token: null })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true })
}
