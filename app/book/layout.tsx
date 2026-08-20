import type { Metadata } from 'next'
import { isStaging } from '@/lib/isStaging'
import { createClient } from '@/lib/supabase/server'

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
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-gray-200 min-h-16 flex items-center flex-shrink-0 px-4 sm:px-6 gap-2 flex-wrap py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bizhaus-logo.png" alt="BizHaus" className="h-5 w-auto flex-shrink-0" />
        <span className="text-xs font-bold bg-booking-600 text-white px-2.5 py-1 rounded flex-shrink-0">Bookings</span>
        <div className="flex-1" />
        {isBookingCustomer ? (
          <a href="/day-pass/account" className="text-sm text-booking-700 font-medium hover:underline whitespace-nowrap">My Bookings</a>
        ) : (
          <span className="text-sm text-gray-500 whitespace-nowrap">
            <span className="hidden sm:inline">Have an account? </span>
            <a href="/day-pass/login" className="text-booking-700 font-medium hover:underline">Log in</a>
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
