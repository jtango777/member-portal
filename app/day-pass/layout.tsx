import type { Metadata } from 'next'
import { isStaging } from '@/lib/isStaging'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: isStaging ? '[Staging] Reserve a Day Pass — BizHaus' : 'Reserve a Day Pass — BizHaus',
  description: 'Reserve a coworking day pass at a BizHaus location. No membership required.',
  icons: {
    icon: '/favicon-green.svg',
  },
}

export default async function DayPassLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Only show "My Reservations" for an actual day-pass customer account —
  // a member who happens to be logged in elsewhere shouldn't see it here.
  let isDayPassCustomer = false
  if (user) {
    const { data: customer } = await supabase.from('booking_customers').select('id').eq('id', user.id).single()
    isDayPassCustomer = !!customer
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center flex-shrink-0 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bizhaus-logo.png" alt="BizHaus" className="h-5 w-auto" />
        <span className="ml-4 text-xs font-bold bg-booking-600 text-white px-2.5 py-1 rounded">Day Pass</span>
        <div className="flex-1" />
        {isDayPassCustomer ? (
          <a href="/day-pass/account" className="text-sm text-booking-700 font-medium hover:underline">My Reservations</a>
        ) : (
          <span className="text-sm text-gray-500">
            Have an account? <a href="/day-pass/login" className="text-booking-700 font-medium hover:underline">Log in</a>
          </span>
        )}
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-white mt-16">
        <div className="max-w-5xl mx-auto px-6 py-6 text-sm text-gray-400">
          © {new Date().getFullYear()} BizHaus ·{' '}
          <a href="mailto:bookings@bizhaus.com" className="hover:text-gray-600 underline">
            bookings@bizhaus.com
          </a>
        </div>
      </footer>
    </div>
  )
}
