'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { AdminTable, Th, tdNowrap, tdBase, Section, Pagination, usePagedList, ListSearch } from './AdminTable'
import { cn } from '@/lib/utils'
import DayPassSettings from './DayPassSettings'
import ClosureDaysManager from './ClosureDaysManager'
import TabPanel from '@/components/TabPanel'
import { CancelRowButton } from './CancelBookingDialog'

type DayPass = {
  id: string
  date: string
  price_cents: number
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled'
  confirmation_number: string | null
  created_at: string
  booking_customers: { id: string; first_name: string; last_name: string; email: string } | null
  locations: { id: string; name: string } | null
}

const STATUS_STYLES: Record<DayPass['status'], string> = {
  confirmed: 'bg-green-50 text-green-700',
  pending: 'bg-amber-50 text-amber-700',
  declined: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

// A multi-day purchase creates one day_passes row per day, all sharing one
// confirmation number — group them back into a single row here so a 3-day
// purchase reads as one purchase, not three identical-looking rows.
function groupByConfirmation(dayPasses: DayPass[]) {
  const groups = new Map<string, DayPass[]>()
  for (const d of dayPasses) {
    const key = d.confirmation_number ?? d.id
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  return [...groups.values()].map(group => {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date))
    return {
      first: sorted[0],
      dates: sorted.map(d => d.date),
      totalCents: sorted.reduce((sum, d) => sum + d.price_cents, 0),
      // Days still live, which is what the staff cancel dialog can act on —
      // a part-cancelled purchase keeps the rest cancellable.
      confirmedDates: sorted.filter(d => d.status === 'confirmed').map(d => d.date),
      // A purchase counts as cancelled only when every day of it is.
      cancelled: sorted.every(d => d.status === 'cancelled'),
    }
  })
}

// Ordering lives with the filters below, since it depends on which column
// is selected. The rule that does not change: cancelled purchases sink to
// the bottom. The list used to sort on the date of the pass, so a cancelled
// booking for late October sat above a real one for today, which is how the
// first actual customer ended up near the bottom (Caroline, 2026-10-01).

type Tab = 'bookings' | 'price' | 'closed'

export default function DayPassesManager({ dayPasses }: { dayPasses: DayPass[] }) {
  // Two jobs on one page: read the bookings, or change the price and the
  // closed days. Settings sat on top of the list and pushed it off screen
  // (Caroline, 2026-09-25), so they're tabs now and the list opens first.
  const [tab, setTab] = useState<Tab>('bookings')
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('all')
  // Sorted by when it was booked, because that is the question the list
  // usually answers: what came in, and when. Click either header to swap.
  const [sortBy, setSortBy] = useState<'booked' | 'date'>('booked')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  function toggleSort(key: 'booked' | 'date') {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('desc') }
  }

  const locationNames = [...new Set(dayPasses.map(d => d.locations?.name).filter(Boolean) as string[])].sort()

  const q = search.trim().toLowerCase()
  const grouped = groupByConfirmation(dayPasses)
    .filter(g => location === 'all' || g.first.locations?.name === location)
    .filter(g => {
      if (!q) return true
      const c = g.first.booking_customers
      // Everything someone might have to hand when they call: a name, an
      // email, the confirmation number off their email, or the location.
      return [
        c ? `${c.first_name} ${c.last_name}` : '',
        c?.email ?? '',
        g.first.confirmation_number ?? '',
        g.first.locations?.name ?? '',
      ].some(v => v.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      // Cancelled purchases always sink, whichever column is sorted.
      if (a.cancelled !== b.cancelled) return a.cancelled ? 1 : -1
      const av = sortBy === 'booked' ? a.first.created_at : a.first.date
      const bv = sortBy === 'booked' ? b.first.created_at : b.first.date
      return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
    })

  const { paged, paginationProps } = usePagedList(grouped, 25)

  const confirmedTotal = dayPasses.filter(d => d.status === 'confirmed').length
  const revenue = dayPasses.filter(d => d.status === 'confirmed').reduce((sum, d) => sum + d.price_cents, 0) / 100

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Day Passes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {confirmedTotal} confirmed · ${revenue.toFixed(2)} in revenue
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {([['bookings', 'Bookings'], ['price', 'Price'], ['closed', 'Closed Days']] as [Tab, string][]).map(([key, label]) => (
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

      {/* key={tab} remounts on every switch, so the panel eases in instead
          of snapping (Caroline, 2026-09-25). */}
      <TabPanel key={tab}>
      {tab === 'price'  && <DayPassSettings />}
      {tab === 'closed' && <ClosureDaysManager product="day_pass" />}

      {tab === 'bookings' && (
      <Section
        title={grouped.length === 1 ? '1 booking' : `${grouped.length} bookings`}
        headerRight={
          <div className="flex items-center gap-3">
            <ListSearch value={search} onChange={setSearch} placeholder="Name, email, confirmation..." />
            {locationNames.length > 1 && (
              <select
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="py-1.5 px-2.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All locations</option>
                {locationNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <Pagination {...paginationProps} />
          </div>
        }
      >
        <AdminTable colWidths={['110px', '180px', '240px', '140px', '90px', '110px', '140px', '80px']} minWidth={1020}>
          <thead>
            <tr>
              <Th>Confirmation</Th>
              <Th sortDir={sortBy === 'date' ? sortDir : null} onClick={() => toggleSort('date')}>Date</Th>
              <Th>Customer</Th>
              <Th>Location</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th sortDir={sortBy === 'booked' ? sortDir : null} onClick={() => toggleSort('booked')}>Booked</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map(({ first: d, dates, totalCents, confirmedDates }) => (
              <tr key={d.confirmation_number ?? d.id} className="hover:bg-gray-50">
                <td className={cn(tdNowrap, 'font-mono text-xs text-gray-500')}>{d.confirmation_number ?? '—'}</td>
                <td className={tdNowrap}>
                  <div>
                    {dates.length > 1
                      ? `${format(new Date(dates[0] + 'T12:00:00'), 'MMM d')} – ${format(new Date(dates[dates.length - 1] + 'T12:00:00'), 'MMM d, yyyy')}`
                      : format(new Date(dates[0] + 'T12:00:00'), 'MMM d, yyyy')}
                  </div>
                  {/* Its own line — beside the date it ran into the customer
                      column on multi-day rows (Caroline, 2026-09-25). */}
                  {dates.length > 1 && <div className="text-xs text-gray-400">{dates.length} days</div>}
                </td>
                <td className="px-4 py-3 truncate">
                  {d.booking_customers ? (
                    <>
                      <div className="font-medium text-gray-900">{d.booking_customers.first_name} {d.booking_customers.last_name}</div>
                      <div className="text-xs text-gray-400">{d.booking_customers.email}</div>
                    </>
                  ) : <span className="text-gray-400">Deleted account</span>}
                </td>
                <td className={tdBase}>{d.locations?.name ?? '—'}</td>
                <td className={tdNowrap}>${(totalCents / 100).toFixed(2)}</td>
                <td className={tdNowrap}>
                  <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_STYLES[d.status])}>
                    {d.status}
                  </span>
                </td>
                <td className={cn(tdNowrap, 'text-gray-400 text-xs')}>{format(new Date(d.created_at), 'MMM d, yyyy')}</td>
                <td className={cn(tdNowrap, 'text-right')}>
                  {confirmedDates.length > 0 && d.confirmation_number && (
                    <CancelRowButton target={{
                      type: 'day_pass',
                      confirmationNumber: d.confirmation_number,
                      who: d.booking_customers ? `${d.booking_customers.first_name} ${d.booking_customers.last_name}` : 'Deleted account',
                      dates: confirmedDates,
                      pricePerDayCents: Math.round(totalCents / dates.length),
                      location: d.locations?.name ?? '',
                    }} />
                  )}
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No day passes yet.</td></tr>
            )}
          </tbody>
        </AdminTable>
      </Section>
      )}
      </TabPanel>
    </div>
  )
}
