import type { Metadata } from 'next'
import { isStaging } from '@/lib/isStaging'
import { createClient } from '@/lib/supabase/server'
import HeaderAccountLink from '@/components/day-pass/HeaderAccountLink'

export const metadata: Metadata = {
  title: isStaging ? '[Staging] Book a Meeting Room — BizHaus' : 'Book a Meeting Room — BizHaus',
  description: 'Reserve a professional meeting room by the hour at BizHaus. No membership required.',
  icons: {
    icon: '/favicon-green.svg',
  },
}

export default async function BookLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isBookingCustomer = false
  if (user) {
    const { data: customer } = await supabase.from('booking_customers').select('id').eq('id', user.id).single()
    isBookingCustomer = !!customer
  }

  return (
    // Same warm off-white ground as the day pass pages, so the white cards
    // read as cards (matches the day pass design pass, 2026-09-17).
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col">
      <header className="bg-white border-b border-gray-200 min-h-16 flex items-center flex-shrink-0 px-4 sm:px-6 gap-2 flex-wrap py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="https://bizhaus.com" className="flex-shrink-0"><img src="/brand/bizhaus-logo.png" alt="BizHaus" className="h-5 w-auto" /></a>
        <span className="text-xs font-bold bg-booking-600 text-white px-2.5 py-1 rounded flex-shrink-0">Bookings</span>
        <div className="flex-1" />
        <HeaderAccountLink initial={isBookingCustomer} />
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
