import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractLinkedinUsername } from '@/lib/linkedin'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { first_name, last_name, default_location_id, company_name, license_plate, seating, linkedin_username } = await request.json()
  const admin = createAdminClient()

  // The Settings page only ever shows an editable Company Name field to
  // admins (everyone else sees their company name as read-only text), but
  // this route had no check of its own — it just trusted the client to
  // have hidden the field, so a direct API call could still let a regular
  // member rename their own (shared, everyone-sees-it) company. Caught
  // 2026-09-11, same audit as the room-access bug.
  //
  // Only block an actual rename: the form sends the company name back
  // unchanged on every save, so rejecting any company_name at all locked
  // every non-admin out of saving Settings (reported 2026-09-15).
  const { data: callerProfile } = await supabase.from('profiles').select('is_admin, companies(name)').eq('id', user.id).single()
  const isAdmin = !!callerProfile?.is_admin
  const currentCompanyName = ((callerProfile?.companies as unknown as { name: string } | null)?.name ?? '').trim()
  if (!isAdmin && typeof company_name === 'string' && company_name.trim() && company_name.trim() !== currentCompanyName) {
    return NextResponse.json({ error: 'Only admins can rename a company.' }, { status: 403 })
  }

  // Never trust the client to have already stripped this down to a bare
  // username — re-extract it here too, so a direct API call can't sneak an
  // arbitrary URL into a field the UI only ever shows as "linkedin.com/in/…".
  let linkedinUsername: string | null = null
  if (typeof linkedin_username === 'string' && linkedin_username.trim()) {
    linkedinUsername = extractLinkedinUsername(linkedin_username)
    if (!linkedinUsername) {
      return NextResponse.json({ error: 'That doesn\'t look like a valid LinkedIn username.' }, { status: 400 })
    }
  }

  // Update profile
  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      first_name: first_name?.trim(),
      last_name: last_name?.trim(),
      full_name: [first_name?.trim(), last_name?.trim()].filter(Boolean).join(' '),
      default_location_id: default_location_id ?? null,
      license_plate: license_plate?.trim() || null,
      seating: seating ?? null,
      linkedin_username: linkedinUsername,
    })
    .eq('id', user.id)

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  // Update company name if provided
  if (isAdmin && company_name?.trim()) {
    const { data: profile } = await admin
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (profile?.company_id) {
      await admin
        .from('companies')
        .update({ name: company_name.trim() })
        .eq('id', profile.company_id)
    }
  }

  return NextResponse.json({ ok: true })
}
