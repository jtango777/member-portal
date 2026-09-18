import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users } from 'lucide-react'

type BookRoom = {
  id: string
  location_id: string
  external_name: string
  capacity: number
  price_per_hour: number
}

type BookLocation = {
  id: string
  name: string
  slug: string
}

// Same open-space photos the day pass location cards use, matched by name
// (lowercased) so a new location without a photo just gets a plain header
// instead of a broken image (matches the day pass design pass, 2026-09-17).
const LOCATION_PHOTOS: Record<string, { src: string; position?: string }> = {
  'el segundo':     { src: '/rooms/es-open-space.jpg' },
  'marina del rey': { src: '/rooms/mdr-open-space.jpg', position: 'center 70%' },
  'costa mesa':     { src: '/rooms/cm-open-space.jpg' },
}

export default async function BookPage() {
  const admin = createAdminClient()

  const [{ data: locations }, { data: rooms }] = await Promise.all([
    admin.from('locations').select('id, name, slug').order('name'),
    admin
      .from('rooms')
      .select('id, location_id, external_name, capacity, price_per_hour, sort_order')
      .eq('external_bookable', true)
      .order('price_per_hour', { ascending: false })
      .order('sort_order'),
  ])

  const roomsByLocation = ((rooms ?? []) as BookRoom[]).reduce<Record<string, BookRoom[]>>(
    (acc, room) => {
      if (!acc[room.location_id]) acc[room.location_id] = []
      acc[room.location_id].push(room)
      return acc
    },
    {}
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1.5 tracking-tight">Book a Meeting Room</h1>
        <p className="text-sm text-gray-500">Meeting and conference rooms by the hour, no membership needed.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {((locations ?? []) as BookLocation[]).map((location) => {
          const locationRooms = roomsByLocation[location.id] ?? []
          const photo = LOCATION_PHOTOS[location.name.trim().toLowerCase()]
          return (
            // White card on the warm ground with a light ring rather than
            // border + shadow, same as the day pass cards.
            <div
              key={location.id}
              className="bg-white ring-1 ring-gray-200/80 rounded-xl overflow-hidden flex flex-col"
            >
              {photo ? (
                <div className="relative aspect-[16/10] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.src}
                    alt={`${location.name} space`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={photo.position ? { objectPosition: photo.position } : undefined}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-gray-900/25 to-transparent" />
                  <h2 className="absolute inset-x-0 bottom-0 p-4 font-semibold text-base text-white leading-tight">
                    {location.name}
                  </h2>
                </div>
              ) : (
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-base text-gray-900">{location.name}</h2>
                </div>
              )}

              <div className="divide-y divide-gray-100 flex-1">
                {locationRooms.map((room) => (
                  <div key={room.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{room.external_name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3" />
                        Up to {room.capacity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">
                      ${room.price_per_hour}
                      <span className="font-normal text-gray-400">/hr</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border-t border-gray-100">
                <Link
                  href={`/book/${location.slug}`}
                  className="block w-full text-center bg-booking-600 hover:bg-booking-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Check Availability →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-10 text-xs text-gray-400 text-center">
        Bookings are non-refundable. Need to cancel?{' '}
        <a href="mailto:bookings@bizhaus.com" className="underline hover:text-gray-600">
          Contact us
        </a>{' '}
        to inquire about credit toward a future booking.
      </p>
    </div>
  )
}
