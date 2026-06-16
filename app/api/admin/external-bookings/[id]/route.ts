import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  // Admin only
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await request.json() // 'confirm' | 'decline'
  if (action !== 'confirm' && action !== 'decline') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: booking } = await adminSupabase
    .from('external_bookings')
    .select('id, status, reservation_id')
    .eq('id', id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.status !== 'pending') {
    return NextResponse.json({ error: 'Booking has already been actioned.' }, { status: 409 })
  }

  if (action === 'confirm') {
    await adminSupabase
      .from('external_bookings')
      .update({ status: 'confirmed' })
      .eq('id', id)
  } else {
    // Decline — release the blocked slot
    if (booking.reservation_id) {
      await adminSupabase.from('reservations').delete().eq('id', booking.reservation_id)
    }
    await adminSupabase
      .from('external_bookings')
      .update({ status: 'declined', reservation_id: null })
      .eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
