import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendInviteEmail } from '@/lib/email'
import { generateToken } from '@/lib/utils'

async function assertCompanyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin, is_company_admin, company_id').eq('id', user.id).single()
  if (!profile || (!profile.is_admin && !profile.is_company_admin) || !profile.company_id) return null
  return { user, companyId: profile.company_id as string }
}

// List members of the caller's own company
export async function GET() {
  const caller = await assertCompanyAdmin()
  if (!caller) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: permittedEmails }, { data: profiles }] = await Promise.all([
    admin.from('permitted_emails').select('*').eq('company_id', caller.companyId).order('invited_at', { ascending: false }),
    admin.from('profiles').select('id, full_name, is_active, is_company_admin').eq('company_id', caller.companyId),
  ])

  const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailToUserId = Object.fromEntries((authUsers ?? []).map(u => [u.email?.toLowerCase() ?? '', u.id]))
  const idToProfile = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const merged = (permittedEmails ?? []).map(pe => {
    const userId = emailToUserId[pe.email?.toLowerCase() ?? ''] ?? null
    const prof = userId ? idToProfile[userId] : null
    return {
      id: pe.id,
      email: pe.email,
      invited_at: pe.invited_at,
      accepted_at: pe.accepted_at,
      user_id: userId,
      full_name: prof?.full_name ?? null,
      is_active: prof?.is_active ?? true,
      is_company_admin: prof?.is_company_admin ?? false,
    }
  })

  return NextResponse.json(merged)
}

// Invite a new member to the caller's own company
export async function POST(request: Request) {
  const caller = await assertCompanyAdmin()
  if (!caller) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const admin = createAdminClient()
  const token = generateToken()

  const { error } = await admin.from('permitted_emails').upsert(
    { email: email.toLowerCase().trim(), company_id: caller.companyId, invite_token: token, invited_at: new Date().toISOString(), accepted_at: null },
    { onConflict: 'email' }
  )

  if (error) {
    console.error('[company/members] POST error:', error.message)
    return NextResponse.json({ error: 'Failed to create invite.' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inviteLink = `${appUrl}/setup-account?token=${token}`
  let emailSent = false
  try {
    await sendInviteEmail(email, token)
    emailSent = true
  } catch (_) {}

  return NextResponse.json({ ok: true, inviteLink, emailSent })
}
