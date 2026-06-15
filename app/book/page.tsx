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
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Book a Meeting Room</h1>
        <p className="text-gray-500">
          Professional meeting spaces by the hour. No membership required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {((locations ?? []) as BookLocation[]).map((location) => {
          const locationRooms = roomsByLocation[location.id] ?? []
          return (
            <div
              key={location.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col"
            >
              <div className="bg-gray-900 text-white px-5 py-4">
                <h2 className="font-semibold text-base">{location.name}</h2>
              </div>

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
                  className="block w-full text-center bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
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
