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

  const { member_id } = await request.json()
  const admin = createAdminClient()

  const { data: invite } = await admin.from('permitted_emails').select('*').eq('id', member_id).single()
  if (!invite || invite.accepted_at) return NextResponse.json({ error: 'Invalid or already accepted' }, { status: 400 })

  const token = generateToken()
  await admin.from('permitted_emails').update({ invite_token: token, invited_at: new Date().toISOString() }).eq('id', member_id)

  await sendInviteEmail(invite.email, token)
  return NextResponse.json({ ok: true })
}
