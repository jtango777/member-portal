import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  return profile?.is_admin ? user : null
}

export async function GET() {
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('announcements')
    .select('id, message, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load announcements.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const caller = await assertAdmin()
  if (!caller) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { message } = await request.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('announcements').insert({
    message: message.trim(),
    created_by: caller.id,
  })

  if (error) return NextResponse.json({ error: 'Failed to post announcement.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
