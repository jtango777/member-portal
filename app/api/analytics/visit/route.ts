import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { path } = await request.json()
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('page_visits')
    .insert({ user_id: user.id, path })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to record visit.' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
