'use client'

import { useState } from 'react'
import RoomsManager from './RoomsManager'
import ExternalRoomsManager from './ExternalRoomsManager'
import ClosureDaysManager from './ClosureDaysManager'
import TabPanel from './TabPanel'
import { cn } from '@/lib/utils'

// Two audiences on one page: the rooms members book on the internal
// calendar, and the rooms the public books at bookings.bizhaus.com. Tabs
// keep them apart, same as the Day Passes page (Caroline, 2026-09-25).
//
// The closed-day list sits under External because that's all it affects:
// members booking internally are never blocked by it.
type Tab = 'internal' | 'external'
type AnyRoom = Parameters<typeof RoomsManager>[0]['initialRooms']
type AnyLocation = Parameters<typeof RoomsManager>[0]['locations']

export default function RoomSettingsTabs({ locations, rooms }: { locations: AnyLocation; rooms: AnyRoom }) {
  const [tab, setTab] = useState<Tab>('internal')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-gray-200">
        {([['internal', 'Internal Rooms'], ['external', 'External Booking Rooms']] as [Tab, string][]).map(([key, label]) => (
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

      {/* key={tab} remounts on every switch, which is what makes the panel
          ease in rather than snap (Caroline, 2026-09-25). */}
      <TabPanel key={tab}>
        {tab === 'internal'
          ? <RoomsManager locations={locations} initialRooms={rooms} />
          : (
            <div className="flex flex-col gap-10">
              <ExternalRoomsManager locations={locations} initialRooms={rooms} />
              <ClosureDaysManager product="rooms" />
            </div>
          )}
      </TabPanel>
    </div>
  )
}
