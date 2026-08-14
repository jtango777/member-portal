import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // 'inactive' — everything else defaults to active

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .select('*')
    .eq('is_active', status === 'inactive' ? false : true)
    .order('name')
  if (error) return NextResponse.json({ error: 'Failed to load companies.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, monthly_hours_allotment } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('companies')
    .insert({ name, monthly_hours_allotment: monthly_hours_allotment ?? 0 })
    .select()
    .single()

  if (error) {
    console.error('[admin/companies] POST error:', error.message)
    return NextResponse.json({ error: 'Failed to create company.' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
