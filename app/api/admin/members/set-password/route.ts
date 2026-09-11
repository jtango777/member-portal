import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { passwordError } from '@/lib/password'

// Lets an admin set a member's password directly, without knowing (or
// needing) their current one — for when someone's locked out and the
// self-serve /forgot-password email flow isn't practical (no access to
// that inbox right now, etc). Uses the service-role client's
// auth.admin.updateUserById, which can set a password outright; there was
// no such path before this — the only reset flow was the member's own
// email link.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { user_id, password } = await request.json()
  if (!user_id || typeof password !== 'string') {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const pwErr = passwordError(password)
  if (pwErr) return NextResponse.json({ error: pwErr }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user_id, { password })
  if (error) {
    console.error('[admin/members/set-password] error:', error.message)
    return NextResponse.json({ error: 'Failed to set password.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
