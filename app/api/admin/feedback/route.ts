import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const resolved = searchParams.get('resolved') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!caller?.is_admin) return NextResponse.json({ error: 'Admins only' }, { status: 403 })

  const [{ data, error }, { data: admins, error: adminsErr }] = await Promise.all([
    supabase
      .from('feedback')
      .select('id, category, message, created_at, notes, assigned_to, profiles!feedback_profile_id_fkey(full_name), assignee:profiles!feedback_assigned_to_fkey(full_name)')
      .eq('resolved', resolved)
      .order('created_at', { ascending: false }),
    // For the "Assign to" dropdown — admins only, matching who could
    // plausibly be assigned a feedback item to triage.
    supabase.from('profiles').select('id, full_name').eq('is_admin', true).order('full_name'),
  ])

  if (error || adminsErr) return NextResponse.json({ error: 'Failed to load feedback.' }, { status: 500 })

  const items = (data ?? []).map(f => ({
    id: f.id,
    category: f.category,
    message: f.message,
    created_at: f.created_at,
    notes: f.notes,
    assigned_to: f.assigned_to,
    full_name: (f.profiles as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
    assignee_name: (f.assignee as unknown as { full_name: string } | null)?.full_name ?? null,
  }))

  return NextResponse.json({ items, admins: admins ?? [] })
}
