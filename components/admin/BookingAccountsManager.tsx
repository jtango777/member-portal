'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Search, User, CreditCard, DoorOpen } from 'lucide-react'
import { AdminTable, Th, tdNowrap, tdBase, Section, Pagination, usePagedList } from './AdminTable'
import { cn } from '@/lib/utils'

type Customer = { id: string; first_name: string; last_name: string; email: string; created_at: string }
type DayPass = { customer_id: string; date: string; price_cents: number; status: string; confirmation_number: string | null; locations: { name: string } | null }
type RoomBooking = {
  customer_id: string | null; start_time: string; end_time: string; status: string
  rooms: { name: string; external_name: string | null; price_per_hour: number | null; locations: { name: string } | null } | null
}

type AccountRow = Customer & {
  dayPassCount: number
  roomBookingCount: number
  lifetimeCents: number
  lastActivity: string | null
}

function roomBookingCents(b: RoomBooking): number {
  const hours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000
  return Math.round(hours * (b.rooms?.price_per_hour ?? 0) * 100)
}

export default function BookingAccountsManager({ customers, dayPasses, roomBookings }: {
  customers: Customer[]
  dayPasses: DayPass[]
  roomBookings: RoomBooking[]
}) {
  const [search, setSearch] = useState('')
  const [onlyZero, setOnlyZero] = useState(false)

  const accounts: AccountRow[] = useMemo(() => {
    return customers.map(c => {
      const passes = dayPasses.filter(d => d.customer_id === c.id)
      const bookings = roomBookings.filter(b => b.customer_id === c.id)

      const confirmedPassCents = passes.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.price_cents, 0)
      const confirmedBookingCents = bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + roomBookingCents(b), 0)

      const lastDates = [
        ...passes.map(d => d.date),
        ...bookings.map(b => b.start_time.slice(0, 10)),
      ].sort()

      return {
        ...c,
        dayPassCount: passes.length,
        roomBookingCount: bookings.length,
        lifetimeCents: confirmedPassCents + confirmedBookingCents,
        lastActivity: lastDates.length ? lastDates[lastDates.length - 1] : null,
      }
    }).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [customers, dayPasses, roomBookings])

  const q = search.trim().toLowerCase()
  const filtered = accounts
    .filter(a => !onlyZero || (a.dayPassCount === 0 && a.roomBookingCount === 0))
    .filter(a => !q || `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))

  const { paged, paginationProps } = usePagedList(filtered, 25)

  const zeroBookingCount = accounts.filter(a => a.dayPassCount === 0 && a.roomBookingCount === 0).length
  const totalLifetimeCents = accounts.reduce((sum, a) => sum + a.lifetimeCents, 0)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Booking Accounts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {accounts.length} account{accounts.length !== 1 ? 's' : ''} · ${(totalLifetimeCents / 100).toFixed(2)} lifetime revenue · {zeroBookingCount} never booked
        </p>
        <p className="text-xs text-gray-400 mt-1">
          One shared login covers both Day Pass and room bookings — this is every account that isn't a BizHaus member.
        </p>
      </div>

      <Section
        title={`${filtered.length} Account${filtered.length !== 1 ? 's' : ''}`}
        headerRight={<Pagination {...paginationProps} />}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-white">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="w-full pl-7 pr-2.5 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none whitespace-nowrap">
            <input type="checkbox" checked={onlyZero} onChange={e => setOnlyZero(e.target.checked)} className="rounded border-gray-300" />
            Never booked only
          </label>
        </div>

        <AdminTable colWidths={['200px', '220px', '110px', '110px', '110px', '110px', '120px']} minWidth={950}>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Created</Th>
              <Th>Day Passes</Th>
              <Th>Room Bookings</Th>
              <Th>Lifetime Spend</Th>
              <Th>Last Activity</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map(a => {
              const neverBooked = a.dayPassCount === 0 && a.roomBookingCount === 0
              return (
                <tr key={a.id} className={cn('hover:bg-gray-50', neverBooked && 'bg-amber-50/40')}>
                  <td className={cn(tdBase, 'font-medium text-gray-900')}>
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-gray-300 flex-shrink-0" />
                      {a.first_name} {a.last_name}
                    </div>
                  </td>
                  <td className={cn(tdBase, 'text-gray-600 truncate')}>{a.email}</td>
                  <td className={cn(tdNowrap, 'text-gray-500')}>{format(new Date(a.created_at), 'MMM d, yyyy')}</td>
                  <td className={tdNowrap}>
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <CreditCard size={12} className="text-gray-300" /> {a.dayPassCount}
                    </span>
                  </td>
                  <td className={tdNowrap}>
                    <span className="inline-flex items-center gap-1 text-gray-700">
                      <DoorOpen size={12} className="text-gray-300" /> {a.roomBookingCount}
                    </span>
                  </td>
                  <td className={cn(tdNowrap, 'font-medium text-gray-900')}>${(a.lifetimeCents / 100).toFixed(2)}</td>
                  <td className={tdNowrap}>
                    {neverBooked ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Never booked</span>
                    ) : (
                      <span className="text-gray-500">{a.lastActivity ? format(new Date(a.lastActivity + 'T12:00:00'), 'MMM d, yyyy') : '—'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </AdminTable>

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            {search ? 'No accounts match your search.' : 'No booking accounts yet.'}
          </div>
        )}
      </Section>
    </div>
  )
}
