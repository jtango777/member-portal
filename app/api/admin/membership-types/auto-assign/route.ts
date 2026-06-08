import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [{ data: types }, { data: companies }] = await Promise.all([
    admin.from('membership_types').select('id, hours_per_month').not('hours_per_month', 'is', null),
    admin.from('companies').select('id, monthly_hours_allotment').is('membership_type_id', null),
  ])

  if (!types || !companies) return NextResponse.json({ error: 'Failed to load data' }, { status: 500 })

  let assigned = 0
  let skipped  = 0

  for (const company of companies) {
    const match = types.find(t => Number(t.hours_per_month) === Number(company.monthly_hours_allotment))
    if (match) {
      await admin.from('companies').update({ membership_type_id: match.id }).eq('id', company.id)
      assigned++
    } else {
      skipped++
    }
  }

  return NextResponse.json({ assigned, skipped })
}
