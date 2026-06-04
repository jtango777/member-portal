import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendCancellationEmail } from '@/lib/email'
import { calcHoursUsed, getMonthBounds } from '@/lib/utils'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch reservation to check ownership
  const { data: reservation } = await adminSupabase
    .from('reservations')
    .select('id, user_id, start_time, company_id')
    .eq('id', id)
    .single()
  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!profile.is_admin) {
    // Members can only edit their own reservations
    if (reservation.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only edit your own reservations.' }, { status: 403 })
    }
    // Must be more than 24 hours away
    const hoursUntil = (new Date(reservation.start_time).getTime() - Date.now()) / 3600000
    if (hoursUntil < 24) {
      return NextResponse.json({ error: 'Reservations cannot be edited within 24 hours of the start time. Please contact an admin.' }, { status: 403 })
    }
  }

  const body = await request.json()
  const { room_id, title, notes, start_time, end_time } = body

  const start = new Date(start_time)
  const end   = new Date(end_time)
  if (end <= start) return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })

  // For non-admins: check hour allotment (excluding this reservation's current hours)
  if (!profile.is_admin && profile.company_id) {
    const { start: monthStart, end: monthEnd } = getMonthBounds(new Date())
    const { data: monthRes } = await adminSupabase
      .from('reservations')
      .select('start_time, end_time')
      .eq('company_id', profile.company_id)
      .neq('id', id) // exclude the reservation being edited
      .gte('start_time', monthStart)
      .lte('end_time', monthEnd)
    const used    = calcHoursUsed(monthRes ?? [])
    const limit   = profile.companies?.monthly_hours_allotment ?? 0
    const newHrs  = (end.getTime() - start.getTime()) / 3600000
    if (used + newHrs > limit) {
      return NextResponse.json(
        { error: `Your company only has ${(limit - used).toFixed(1)}h remaining this month.` },
        { status: 403 }
      )
    }
  }

  // Check conflicts (excluding this reservation)
  const { data: conflicts } = await adminSupabase
    .from('reservations')
    .select('id')
    .eq('room_id', room_id)
    .neq('id', id)
    .lt('start_time', end_time)
    .gt('end_time', start_time)

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'This room is already booked for that time.' }, { status: 409 })
  }

  const { data, error } = await adminSupabase
    .from('reservations')
    .update({ room_id, title, notes: notes || null, start_time, end_time })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()

  // Fetch the reservation to check ownership
  const { data: reservation } = await adminSupabase
    .from('reservations')
    .select('*, profiles(full_name), rooms(name, locations(name))')
    .eq('id', id)
    .single()

  if (!reservation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!profile?.is_admin) {
    // Regular user: can only cancel their own future (not same-day) reservations
    if (reservation.user_id !== user.id) {
      return NextResponse.json({ error: 'You can only cancel your own reservations.' }, { status: 403 })
    }
    const startDate  = new Date(reservation.start_time)
    const hoursUntil = (startDate.getTime() - Date.now()) / 3600000
    if (hoursUntil < 24) {
      return NextResponse.json({ error: 'Reservations cannot be cancelled within 24 hours of the start time. Please contact an admin.' }, { status: 403 })
    }
  }

  const { error } = await adminSupabase.from('reservations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send cancellation email (non-blocking)
  try {
    const { data: { user: authUser } } = await adminSupabase.auth.admin.getUserById(reservation.user_id)
    if (authUser?.email) {
      const room  = (reservation as any).rooms
      const start = new Date(reservation.start_time)
      const end   = new Date(reservation.end_time)
      const tz    = 'America/Los_Angeles'
      const fmtTime = (d: Date) => d.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })
      const fmtDate = (d: Date) => d.toLocaleString('en-US', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      await sendCancellationEmail(authUser.email, {
        title:    reservation.title,
        room:     room?.name ?? '',
        location: room?.locations?.name ?? '',
        date:     fmtDate(start),
        time:     `${fmtTime(start)} – ${fmtTime(end)}`,
      })
    }
  } catch (_) {}

  return NextResponse.json({ ok: true })
}
