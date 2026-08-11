import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { calcHoursUsed, getMonthBounds, getPacificDayBounds } from '@/lib/utils'
import { sendConfirmationEmail } from '@/lib/email'
import { getOrCreateGuestUserId } from '@/lib/guestAccount'
import { resolveHistoricalBookings } from '@/lib/resolveHistoricalBookings'
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
  // Admin client for the permitted_emails lookup specifically — RLS on that
  // table can silently starve this under a regular member's session.
  const resolved = await resolveHistoricalBookings(createAdminClient(), data ?? [])
  return NextResponse.json(resolved)
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

  // A company gives a shared pool; individual_hours_allotment (set directly
  // when there's no company) gives a personal one. Neither means the
  // account isn't set up for room access yet.
  if (!profile.is_admin && !profile.company_id && !profile.individual_hours_allotment) {
    return NextResponse.json({ error: 'Your account is not set up for room access. Contact your admin.' }, { status: 403 })
  }

  const body = await request.json()
  const { room_id, title, notes, start_time, end_time, formatted_date, formatted_time, owner_id, owner_company_id, historical_email } = body

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
    // Check each occurrence for conflicts before inserting
    for (const occ of records) {
      const { data: conflicts } = await adminSupabase
        .from('reservations')
        .select('id')
        .eq('room_id', room_id)
        .lt('start_time', occ.end_time)
        .gt('end_time', occ.start_time)
      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({
          error: `Conflict found on ${format(new Date(occ.start_time), 'MMM d, yyyy')} — cannot create recurring block.`
        }, { status: 409 })
      }
    }

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

  // Check hour allotment for non-admins — a shared company pool if they
  // have one, otherwise their own individual pool.
  if (!profile.is_admin && (profile.company_id || profile.individual_hours_allotment)) {
    const { start: monthStart, end: monthEnd } = getMonthBounds(start)
    let monthQuery = adminSupabase
      .from('reservations')
      .select('start_time, end_time')
      .gte('start_time', monthStart)
      .lt('start_time', monthEnd)
    monthQuery = profile.company_id
      ? monthQuery.eq('company_id', profile.company_id)
      : monthQuery.eq('user_id', user.id)
    const { data: monthRes } = await monthQuery

    const used   = calcHoursUsed(monthRes ?? [])
    const limit  = profile.company_id ? (profile.companies?.monthly_hours_allotment ?? 0) : (profile.individual_hours_allotment ?? 0)
    const newHrs = (end.getTime() - start.getTime()) / 3600000
    if (used + newHrs > limit) {
      const whose = profile.company_id ? 'Your company' : 'You'
      return NextResponse.json(
        { error: `${whose} only ${profile.company_id ? 'has' : 'have'} ${(limit - used).toFixed(1)}h remaining this month.` },
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
  const bookingOnBehalf = profile.is_admin && (owner_id || historical_email)
  // Pending member (no real account yet) — attribute to the Guest
  // placeholder and tag with their email so it auto-links at signup.
  const bookingUserId = bookingOnBehalf
    ? (owner_id ? owner_id : await getOrCreateGuestUserId(adminSupabase))
    : user.id
  // Use owner_id/historical_email's presence (not owner_company_id's
  // truthiness) to decide whether we're booking on behalf of someone else —
  // otherwise a company-less member being booked for falls through to the
  // admin's own company_id instead of staying null.
  const bookingCompanyId = bookingOnBehalf ? (owner_company_id ?? null) : profile.company_id

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
      historical_email: profile.is_admin && historical_email ? historical_email : null,
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

  // Send confirmation email to the owner (non-blocking)
  try {
    const room = (reservation as any).rooms
    let recipientEmail = user.email!
    let bookerName = profile.full_name

    if (profile.is_admin && owner_id && owner_id !== user.id) {
      const { data: { user: ownerUser } } = await adminSupabase.auth.admin.getUserById(owner_id)
      if (ownerUser?.email) recipientEmail = ownerUser.email
      const { data: ownerProfile } = await adminSupabase.from('profiles').select('full_name').eq('id', owner_id).single()
      if (ownerProfile) bookerName = ownerProfile.full_name
    } else if (profile.is_admin && historical_email) {
      recipientEmail = historical_email
      const { data: pendingMember } = await adminSupabase.from('permitted_emails').select('full_name').eq('email', historical_email).single()
      if (pendingMember?.full_name) bookerName = pendingMember.full_name
    }

    await sendConfirmationEmail(recipientEmail, {
      title,
      room:    room?.name ?? '',
      location: room?.locations?.name ?? '',
      date:    formatted_date ?? format(start, 'EEEE, MMMM d, yyyy'),
      time:    formatted_time ?? `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`,
      booker:  bookerName,
    })
  } catch (_) { /* Email failure should not block the booking */ }

  return NextResponse.json(reservation, { status: 201 })
}
