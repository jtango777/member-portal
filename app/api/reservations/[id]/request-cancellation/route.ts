import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendCancellationRequestEmail, sendSystemAlert } from '@/lib/email'
import { format } from 'date-fns'

// A member can't self-cancel within 12 hours of the start time (see
// DELETE below) — instead this flags the reservation and emails the
// BizHaus team to review and cancel it manually if appropriate.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()

  const { data: reservation } = await adminSupabase
    .from('reservations')
    .select('*, rooms(name, locations(name))')
    .eq('id', id)
    .single()

  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (reservation.user_id !== user.id) {
    return NextResponse.json({ error: 'You can only request cancellation of your own reservations.' }, { status: 403 })
  }
  if (reservation.cancellation_requested_at) {
    return NextResponse.json({ ok: true, alreadyRequested: true })
  }

  const { error } = await adminSupabase
    .from('reservations')
    .update({ cancellation_requested_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('[reservations] request-cancellation error:', error.message)
    return NextResponse.json({ error: 'Failed to submit request.' }, { status: 500 })
  }

  try {
    const room = (reservation as any).rooms
    const start = new Date(reservation.start_time)
    const end   = new Date(reservation.end_time)
    await sendCancellationRequestEmail({
      name:     profile?.full_name ?? 'A member',
      email:    user.email ?? '',
      title:    reservation.title,
      room:     room?.name ?? '',
      location: room?.locations?.name ?? '',
      date:     format(start, 'EEEE, MMMM d, yyyy'),
      time:     `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`,
    })
  } catch (err) {
    console.error('[reservations] cancellation-request email failed:', err)
    await sendSystemAlert('Reservation cancellation-request email failed', {
      reservation_id: id, user_id: user.id, error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({ ok: true })
}
