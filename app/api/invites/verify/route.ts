import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) return NextResponse.json({ valid: false })

  const admin = createAdminClient()
  const { data } = await admin
    .from('permitted_emails')
    .select('email, accepted_at, default_location_id, first_name, last_name, seating')
    .eq('invite_token', token)
    .single()

  if (!data || data.accepted_at) return NextResponse.json({ valid: false })
  return NextResponse.json({
    valid: true,
    email: data.email,
    default_location_id: data.default_location_id,
    // Pre-fills the name fields on the setup form when we already have a
    // name on file for this invite (most of them, from the GetaRoom/CSV
    // imports) — no reason to make someone retype "Jane Smith" over the
    // placeholder when we already know who they are.
    first_name: data.first_name,
    last_name: data.last_name,
    // Same idea for seating — an admin picking "Office - Main Building"
    // when adding someone should actually carry through to signup instead
    // of silently getting dropped, which is what was happening: this route
    // never even selected the column, so the setup form had nothing to
    // prefill from and always fell back to whatever came first.
    seating: data.seating,
  })
}
