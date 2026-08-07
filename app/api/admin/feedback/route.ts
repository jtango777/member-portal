import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const { data, error } = await supabase
    .from('feedback')
    .select('id, category, message, created_at, profiles(full_name)')
    .eq('resolved', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load feedback.' }, { status: 500 })

  const feedback = (data ?? []).map(f => ({
    id: f.id,
    category: f.category,
    message: f.message,
    created_at: f.created_at,
    full_name: (f.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
  }))

  return NextResponse.json(feedback)
}
