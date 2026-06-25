import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calcHoursUsed, getMonthBounds, getPacificDayBounds } from '@/lib/utils'
import { sendConfirmationEmail } from '@/lib/email'
import { format } from 'date-fns'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('locationId')
  const date       = searchParams.get('date') // YYYY-MM-DD

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = supabase
    .from('reservations')
    .select('*, profiles(id, full_name), companies(id, name), rooms(id, name, location_id, capacity)')
    .order('start_time')

  if (date) {
    const { start, end } = getPacificDayBounds(date)
    query = query.gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
  }

  if (locationId) {
    // Filter by location via room's location_id — use a subquery approach
    const { data: roomIds } = await supabase.from('rooms').select('id').eq('location_id', locationId)
    if (roomIds && roomIds.length > 0) {
      query = query.in('room_id', roomIds.map(r => r.id))
    } else {
      return NextResponse.json([])
    }
  }

  const { data, error } = await query
  if (error) {
    console.error('[reservations] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to load reservations.' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase      = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  const body = await request.json()
  const { room_id, title, notes, start_time, end_time, formatted_date, formatted_time, owner_id, owner_company_id } = body

  // ── Recurring admin block ──────────────────────────────────────────────────
  if (body.occurrences && Array.isArray(body.occurrences)) {
    if (!profile.is_admin) {
      return NextResponse.json({ error: 'Only admins can create recurring blocks.' }, { status: 403 })
    }
    if (!room_id || !title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const groupId = crypto.randomUUID()
    const records = (body.occurrences as Array<{ start_time: string; end_time: string }>).map(o => ({
      room_id,
      user_id:              user.id,
      company_id:           profile.company_id,
      title:                title.trim(),
      notes:                notes?.trim() || null,
      start_time:           o.start_time,
      end_time:             o.end_time,
      is_admin_block:       true,
      recurrence_group_id:  groupId,
    }))
    const { error } = await adminSupabase.from('reservations').insert(records)
    if (error) {
      console.error('[reservations] Recurring insert error:', error.message)
      return NextResponse.json({ error: 'Failed to create recurring reservation.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, recurrence_group_id: groupId, count: records.length }, { status: 201 })
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (!room_id || !title || !start_time || !end_time) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const start = new Date(start_time)
  const end   = new Date(end_time)
  if (end <= start) return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })

  // Check hour allotment for non-admins
  if (!profile.is_admin && profile.company_id) {
    const { start: monthStart, end: monthEnd } = getMonthBounds(new Date())
    const { data: monthRes } = await adminSupabase
      .from('reservations')
      .select('start_time, end_time')
      .eq('company_id', profile.company_id)
      .gte('start_time', monthStart)
      .lte('end_time', monthEnd)

    const used   = calcHoursUsed(monthRes ?? [])
    const limit  = profile.companies?.monthly_hours_allotment ?? 0
    const newHrs = (end.getTime() - start.getTime()) / 3600000
    if (used + newHrs > limit) {
      return NextResponse.json(
        { error: `Your company only has ${(limit - used).toFixed(1)}h remaining this month.` },
        { status: 403 }
      )
    }
  }

  // Check for conflicts on the same room
  const { data: conflicts } = await adminSupabase
    .from('reservations')
    .select('id, title, start_time, end_time, profiles(full_name), companies(name)')
    .eq('room_id', room_id)
    .lt('start_time', end_time)
    .gt('end_time', start_time)

  if (conflicts && conflicts.length > 0) {
    if (profile.is_admin) {
      return NextResponse.json({
        error: 'conflict',
        conflicts: conflicts.map((c: any) => ({
          id:         c.id,
          title:      c.title,
          start_time: c.start_time,
          end_time:   c.end_time,
          booked_by:  c.profiles?.full_name ?? 'Unknown',
          company:    c.companies?.name ?? '',
        })),
      }, { status: 409 })
    }
    return NextResponse.json({ error: 'This room is already booked for that time.' }, { status: 409 })
  }

  // For admin booking on behalf of a member, use the provided owner_id/owner_company_id
  const bookingUserId = profile.is_admin && owner_id ? owner_id : user.id
  const bookingCompanyId = profile.is_admin && owner_company_id ? owner_company_id : profile.company_id

  const { data: reservation, error } = await adminSupabase
    .from('reservations')
    .insert({
      room_id,
      user_id:    bookingUserId,
      company_id: bookingCompanyId,
      title,
      notes:      notes || null,
      start_time,
      end_time,
    })
    .select('*, rooms(name, locations(name))')
    .single()

  if (error) {
    if (error.message?.includes('no_overlapping_reservations')) {
      return NextResponse.json({ error: 'This room is already booked for that time.' }, { status: 409 })
    }
    console.error('[reservations] Insert error:', error.message)
    return NextResponse.json({ error: 'Failed to create reservation.' }, { status: 500 })
  }

  // Send confirmation email (non-blocking)
  try {
    const room = (reservation as any).rooms
    await sendConfirmationEmail(user.email!, {
      title,
      room:    room?.name ?? '',
      location: room?.locations?.name ?? '',
      date:    formatted_date ?? format(start, 'EEEE, MMMM d, yyyy'),
      time:    formatted_time ?? `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`,
      booker:  profile.full_name,
    })
  } catch (_) { /* Email failure should not block the booking */ }

  return NextResponse.json(reservation, { status: 201 })
}
