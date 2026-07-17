import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { full_name, default_location_id, company_name, license_plate, seating } = await request.json()
  const admin = createAdminClient()

  // Update profile
  const { error: profileErr } = await admin
    .from('profiles')
    .update({
      full_name: full_name?.trim(),
      default_location_id: default_location_id ?? null,
      license_plate: license_plate?.trim() || null,
      seating: seating ?? null,
    })
    .eq('id', user.id)

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  // Update company name if provided
  if (company_name?.trim()) {
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
