import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { token, name, password } = await request.json()

  if (!token || !name || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify token
  const { data: invite } = await admin
    .from('permitted_emails')
    .select('*')
    .eq('invite_token', token)
    .single()

  if (!invite || invite.accepted_at) {
    return NextResponse.json({ error: 'Invalid or already-used invite link.' }, { status: 400 })
  }

  // Create auth user (skip email confirmation since they validated via invite token)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:          invite.email,
    password,
    email_confirm:  true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const userId = authData.user!.id

  // Create profile
  await admin.from('profiles').insert({
    id:         userId,
    company_id: invite.company_id,
    full_name:  name.trim(),
    is_admin:   false,
  })

  // Mark invite as accepted
  await admin
    .from('permitted_emails')
    .update({ accepted_at: new Date().toISOString(), invite_token: null })
    .eq('id', invite.id)

  return NextResponse.json({ ok: true })
}
