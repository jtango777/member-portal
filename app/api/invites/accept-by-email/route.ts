import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { suggestCompanyForEmail } from '@/lib/suggestCompany'

export async function POST(request: Request) {
  const { email, first_name, last_name, password, default_location_id, seating } = await request.json()

  if (!email || !first_name || !last_name || !password) {
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

  // If no company was already set on the invite, check their own booking
  // history (getaroom-imported reservations) for one before falling back
  // to no company at all.
  const companyId = invite.company_id ?? await suggestCompanyForEmail(admin, invite.email, userId)

  // A handful of companies (BizHaus Admin/Staff) are flagged to grant admin
  // automatically on signup — an explicit per-company switch rather than
  // inferring it from the company's name, which would be fragile (renames,
  // typos, duplicates). Doesn't touch anyone already registered.
  let grantsAdmin = false
  if (companyId) {
    const { data: company } = await admin.from('companies').select('grants_admin').eq('id', companyId).single()
    grantsAdmin = company?.grants_admin ?? false
  }

  await admin.from('profiles').insert({
    id:                  userId,
    company_id:          companyId,
    individual_hours_allotment: invite.individual_hours_allotment ?? null,
    first_name:          first_name.trim(),
    last_name:           last_name.trim(),
    full_name:           `${first_name.trim()} ${last_name.trim()}`.trim(),
    is_admin:            grantsAdmin,
    default_location_id: default_location_id ?? invite.default_location_id ?? null,
    avatar_url:          invite.avatar_url ?? null,
    seating:             seating ?? invite.seating ?? null,
  })

  await admin
    .from('permitted_emails')
    .update({ accepted_at: new Date().toISOString(), invite_token: null, company_id: companyId })
    .eq('id', invite.id)

  // Reassign any historical (pre-signup) bookings tagged with this email to
  // the real account they just created.
  await admin
    .from('reservations')
    .update({ user_id: userId, historical_email: null })
    .ilike('historical_email', invite.email)

  return NextResponse.json({ ok: true })
}
