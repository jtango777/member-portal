import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AvailabilityView from '@/components/book/AvailabilityView'

type BookRoom = {
  id: string
  location_id: string
  external_name: string
  capacity: number
  price_per_hour: number
  sort_order: number
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

  const { data: rooms } = await admin
    .from('rooms')
    .select('id, location_id, external_name, capacity, price_per_hour, sort_order')
    .eq('location_id', location.id)
    .eq('external_bookable', true)
    .order('price_per_hour', { ascending: false })
    .order('sort_order')

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <AvailabilityView
        location={location as BookLocation}
        rooms={(rooms ?? []) as BookRoom[]}
      />
    </div>
  )
}
