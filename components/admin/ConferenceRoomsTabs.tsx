'use client'

import { useState } from 'react'
import AllBookingsView from './AllBookingsView'
import RoomsManager from './RoomsManager'
import ExternalRoomsManager from './ExternalRoomsManager'
import ClosureDaysManager from './ClosureDaysManager'
import TabPanel from '@/components/TabPanel'
import { cn } from '@/lib/utils'

// Everything about conference rooms in one place: who booked them, the
// rooms themselves, and the days they can't be booked.
//
// It used to be split between "Room Settings" and "All Bookings", which
// promised every booking but only ever held room bookings — day passes were
// somewhere else entirely (Caroline, 2026-09-25). Day passes keep their own
// page with the same shape: bookings, settings, closed days.
//
// Closed days only affect the public booking site; members booking on the
// internal calendar are never blocked by them.
type Tab = 'bookings' | 'internal' | 'external' | 'closed'

const TABS: [Tab, string][] = [
  ['bookings', 'All Bookings'],
  ['internal', 'Internal Rooms'],
  ['external', 'External Rooms'],
  ['closed',   'Closed Days'],
]

type Props = {
  reservations: Parameters<typeof AllBookingsView>[0]['reservations']
  externalBookings: Parameters<typeof AllBookingsView>[0]['externalBookings']
  locations: Parameters<typeof RoomsManager>[0]['locations']
  rooms: Parameters<typeof RoomsManager>[0]['initialRooms']
}

export default function ConferenceRoomsTabs({ reservations, externalBookings, locations, rooms }: Props) {
  const [tab, setTab] = useState<Tab>('bookings')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Conference Rooms</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Bookings, the rooms themselves, and the days they&apos;re closed.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* key={tab} remounts on every switch, which is what eases the panel in. */}
      <TabPanel key={tab}>
        {tab === 'bookings' && <AllBookingsView reservations={reservations} externalBookings={externalBookings} hideHeading />}
        {tab === 'internal' && <RoomsManager locations={locations} initialRooms={rooms} />}
        {tab === 'external' && <ExternalRoomsManager locations={locations} initialRooms={rooms} />}
        {tab === 'closed'   && <ClosureDaysManager product="rooms" />}
      </TabPanel>
    </div>
  )
}
