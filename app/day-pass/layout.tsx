import type { Metadata } from 'next'
import { isStaging } from '@/lib/isStaging'
import { createClient } from '@/lib/supabase/server'
import HeaderAccountLink from '@/components/day-pass/HeaderAccountLink'

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
    // Warm off-white ground so the white cards read as cards, rather than
    // white-on-white (design pass, 2026-09-17).
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <header className="bg-white border-b border-gray-200 min-h-16 flex items-center flex-shrink-0 px-4 sm:px-6 gap-2 flex-wrap py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="https://bizhaus.com" className="flex-shrink-0"><img src="/brand/bizhaus-logo.png" alt="BizHaus" className="h-5 w-auto" /></a>
        <span className="text-xs font-bold bg-booking-600 text-white px-2.5 py-1 rounded flex-shrink-0">Day Pass</span>
        <div className="flex-1" />
        <HeaderAccountLink initial={isDayPassCustomer} />
      </header>
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-[#FAF9F7] mt-16">
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
