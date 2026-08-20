'use client'

import { format } from 'date-fns'
import { AdminTable, Th, tdNowrap, tdBase, Section, Pagination, usePagedList } from './AdminTable'
import { cn } from '@/lib/utils'

type DayPass = {
  id: string
  date: string
  price_cents: number
  status: 'pending' | 'confirmed' | 'declined'
  confirmation_number: string | null
  created_at: string
  booking_customers: { id: string; first_name: string; last_name: string; email: string } | null
  locations: { id: string; name: string } | null
}

const STATUS_STYLES: Record<DayPass['status'], string> = {
  confirmed: 'bg-green-50 text-green-700',
  pending: 'bg-amber-50 text-amber-700',
  declined: 'bg-red-50 text-red-700',
}

export default function DayPassesManager({ dayPasses }: { dayPasses: DayPass[] }) {
  const { paged, paginationProps } = usePagedList(dayPasses, 25)

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

      <Section title={`${dayPasses.length} Day Passes`} headerRight={<Pagination {...paginationProps} />}>
        <AdminTable colWidths={['110px', '160px', '220px', '140px', '90px', '110px', '140px']} minWidth={900}>
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
            {paged.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className={cn(tdNowrap, 'font-mono text-xs text-gray-500')}>{d.confirmation_number ?? '—'}</td>
                <td className={tdNowrap}>{format(new Date(d.date + 'T12:00:00'), 'MMM d, yyyy')}</td>
                <td className="px-4 py-3 truncate">
                  {d.booking_customers ? (
                    <>
                      <div className="font-medium text-gray-900">{d.booking_customers.first_name} {d.booking_customers.last_name}</div>
                      <div className="text-xs text-gray-400">{d.booking_customers.email}</div>
                    </>
                  ) : <span className="text-gray-400">Deleted account</span>}
                </td>
                <td className={tdBase}>{d.locations?.name ?? '—'}</td>
                <td className={tdNowrap}>${(d.price_cents / 100).toFixed(2)}</td>
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
    </div>
  )
}
