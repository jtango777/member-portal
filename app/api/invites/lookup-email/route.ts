import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { findAuthUserByEmail } from '@/lib/authLookup'

export async function POST(request: Request) {
  const { email } = await request.json()
  if (!email) return NextResponse.json({ status: 'not_found' })

  const admin = createAdminClient()
  const { data } = await admin
    .from('permitted_emails')
    .select('email, accepted_at, default_location_id, first_name, last_name, seating')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!data) return NextResponse.json({ status: 'not_found' })
  if (data.accepted_at) return NextResponse.json({ status: 'already_registered' })
  // Whether they already have a BizHaus login, from buying a day pass or
  // booking a room before being invited as a member. This route has no
  // emailed token to prove who they are, so accepting asks for that
  // existing password rather than setting a new one. The form needs to know
  // that up front, instead of only telling them once they have guessed
  // wrong (Caroline, 2026-10-16).
  const existingLogin = await findAuthUserByEmail(admin, data.email)

  return NextResponse.json({
    status: 'ok',
    email: data.email,
    has_existing_login: !!existingLogin,
    default_location_id: data.default_location_id,
    // Whatever the admin already entered when they added this member —
    // prefilled below so the member isn't re-typing info that's already on
    // file, but every field stays editable in case it's wrong or changed.
    first_name: data.first_name,
    last_name:  data.last_name,
    seating:    data.seating,
  })
}
