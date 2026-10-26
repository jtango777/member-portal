import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AvailabilityView from '@/components/book/AvailabilityView'
import { getClosureMap } from '@/lib/settings'

type BookRoom = {
  id: string
  location_id: string
  external_name: string
  capacity: number
  price_per_hour: number
  sort_order: number
  photo_urls: string[] | null
}

type BookLocation = {
  id: string
  name: string
  slug: string
}

export default async function BookLocationPage({ params }: { params: Promise<{ location: string }> }) {
  const { location: slug } = await params
  const admin = createAdminClient()

  const { data: location } = await admin
    .from('locations')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (!location) notFound()

  // Staff edit these at /dashboard/admin/day-passes; the routes check the
  // same list again before taking any money.
  const closures = await getClosureMap('rooms')

  const loadRooms = (columns: string) => admin
    .from('rooms')
    .select(columns)
    .eq('location_id', location.id)
    .eq('external_bookable', true)
    .order('price_per_hour', { ascending: false })
    .order('sort_order')

  const BASE = 'id, location_id, external_name, capacity, price_per_hour, sort_order, description'
  let { data: rooms, error } = await loadRooms(`${BASE}, photo_urls`)
  // A database without migration 062 has no photo_urls, and asking for it
  // fails the whole query: the page showed no rooms at all (staging,
  // 2026-10-26). Bookable rooms without photos beat no rooms, so retry
  // without it rather than let a deploy that got ahead of its migration
  // close the booking page.
  if (error?.message.includes('photo_urls')) {
    console.error(`[book/${slug}] photo_urls missing, run migration 062. Loading rooms without photos.`)
    ;({ data: rooms, error } = await loadRooms(BASE))
  }
  if (error) console.error(`[book/${slug}] Could not load rooms:`, error.message)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <AvailabilityView
        closures={closures}
        location={location as BookLocation}
        rooms={(rooms ?? []) as unknown as BookRoom[]}
      />
    </div>
  )
}
