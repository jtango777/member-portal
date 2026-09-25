'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { AdminTable, Th, tdNowrap, tdBase, Section, Pagination, usePagedList } from './AdminTable'
import { cn } from '@/lib/utils'
import DayPassSettings from './DayPassSettings'
import ClosureDaysManager from './ClosureDaysManager'
import TabPanel from '@/components/TabPanel'

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
    return { first: sorted[0], dates: sorted.map(d => d.date), totalCents: sorted.reduce((sum, d) => sum + d.price_cents, 0) }
  }).sort((a, b) => b.first.date.localeCompare(a.first.date))
}

type Tab = 'bookings' | 'price' | 'closed'

export default function DayPassesManager({ dayPasses }: { dayPasses: DayPass[] }) {
  // Two jobs on one page: read the bookings, or change the price and the
  // closed days. Settings sat on top of the list and pushed it off screen
  // (Caroline, 2026-09-25), so they're tabs now and the list opens first.
  const [tab, setTab] = useState<Tab>('bookings')
  const grouped = groupByConfirmation(dayPasses)
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
      <Section title={`${dayPasses.length} Day Passes`} headerRight={<Pagination {...paginationProps} />}>
        <AdminTable colWidths={['110px', '180px', '240px', '140px', '90px', '110px', '140px']} minWidth={940}>
          <thead>
            <tr>
              <Th>Confirmation</Th>
              <Th>Date</Th>
              <Th>Customer</Th>
              <Th>Location</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th>Booked</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map(({ first: d, dates, totalCents }) => (
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
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No day passes yet.</td></tr>
            )}
          </tbody>
        </AdminTable>
      </Section>
      )}
      </TabPanel>
    </div>
  )
}
