import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lightweight list of already-registered members, for admin "book on behalf
// of" pickers. Unlike /api/admin/members/details, this never needs to bridge
// through the Auth Admin API or merge in pending invites — every profile row
// here already is a registered member.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, company_id, is_active, companies(name)')
    .eq('is_active', true)
    .order('full_name')

  if (error) return NextResponse.json({ error: 'Failed to load members.' }, { status: 500 })

  const members = (data ?? []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    company_id: p.company_id,
    company_name: (p.companies as unknown as { name: string } | null)?.name ?? '',
  }))

  return NextResponse.json(members)
}
