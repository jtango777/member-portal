import { createAdminClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { format } from 'date-fns'
import BookingForm from '@/components/book/BookingForm'

function slotToLabel(slot: string): string {
  const [h, m] = slot.split(':').map(Number)
  return format(new Date(2000, 0, 1, h, m), 'h:mm a')
}

export default async function BookRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; date?: string; start?: string; end?: string; location?: string }>
}) {
  const { room: roomId, date, start, end, location: locationSlug } = await searchParams

  if (!roomId || !date || !start || !end || !locationSlug) redirect('/book')

  const admin = createAdminClient()

  const [{ data: room }, { data: location }] = await Promise.all([
    admin
      .from('rooms')
      .select('id, name, external_name, capacity, price_per_hour, location_id')
      .eq('id', roomId)
      .eq('external_bookable', true)
      .single(),
    admin
      .from('locations')
      .select('id, name, slug')
      .eq('slug', locationSlug)
      .single(),
  ])

  if (!room || !location) notFound()

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <BookingForm
        roomId={room.id}
        roomName={room.external_name ?? room.name}
        locationName={location.name}
        locationSlug={location.slug}
        capacity={room.capacity}
        pricePerHour={room.price_per_hour}
        date={date}
        start={start}
        end={end}
        startLabel={slotToLabel(start)}
        endLabel={slotToLabel(end)}
      />
    </div>
  )
}
