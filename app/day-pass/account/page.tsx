import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import SignOutButton from '@/components/day-pass/SignOutButton'

export const dynamic = 'force-dynamic'

const STATUS_ICON = { confirmed: CheckCircle, pending: Clock, declined: XCircle } as const
const STATUS_STYLES = {
  confirmed: 'text-green-600 bg-green-50',
  pending: 'text-amber-600 bg-amber-50',
  declined: 'text-red-600 bg-red-50',
} as const

export default async function DayPassAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/day-pass/login')

  // RLS scopes both of these to the logged-in customer's own rows (see
  // migration 044) — no admin bypass needed or wanted here.
  const { data: customer } = await supabase
    .from('booking_customers')
    .select('first_name, last_name, email')
    .eq('id', user.id)
    .single()

  // Not a day-pass customer account (e.g. a member's own login) — nothing
  // to show here.
  if (!customer) redirect('/day-pass')

  const { data: dayPasses } = await supabase
    .from('day_passes')
    .select('*, locations(id, name)')
    .eq('customer_id', user.id)
    .order('date', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Hi, {customer.first_name}
          </h1>
          <p className="text-sm text-gray-500">{customer.email}</p>
        </div>
        <SignOutButton />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your Reservations</h2>
        <a href="/day-pass" className="text-sm font-medium text-booking-600 hover:text-booking-700">+ Reserve another</a>
      </div>

      {!dayPasses?.length && (
        <div className="border border-dashed border-gray-200 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
          No reservations yet.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {dayPasses?.map(pass => {
          const Icon = STATUS_ICON[pass.status as keyof typeof STATUS_ICON]
          return (
            <div key={pass.id} className="border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-gray-900">
                  {format(new Date(pass.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {pass.locations?.name ?? 'Unknown location'} · ${(pass.price_cents / 100).toFixed(2)}
                  {pass.confirmation_number && <> · #{pass.confirmation_number}</>}
                </div>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize flex-shrink-0', STATUS_STYLES[pass.status as keyof typeof STATUS_STYLES])}>
                <Icon size={13} /> {pass.status}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
