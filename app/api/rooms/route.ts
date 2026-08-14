import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')
  // Admin management pages (Room Settings) need to see every room,
  // including ones hidden from the internal booking calendar, so they can
  // still be un-hidden. Everyone else (the actual booking flow) only sees
  // bookable rooms.
  const includeHidden = searchParams.get('includeHidden') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const query = supabase.from('rooms').select('*').order('name')
  if (locationId) query.eq('location_id', locationId)
  if (!includeHidden) query.eq('internal_bookable', true)

  const { data, error } = await query
  if (error) {
    console.error('[rooms] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to load rooms.' }, { status: 500 })
  }
  return NextResponse.json(data)
}
