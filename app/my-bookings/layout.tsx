import type { Metadata } from 'next'
import { isStaging } from '@/lib/isStaging'

// The shared booking account area — day passes AND room bookings — so it
// has its own neutral "Bookings" header instead of living under /day-pass
// (moved from /day-pass/account + /day-pass/login on 2026-09-15; the old
// URLs redirect here via next.config.ts).
export const metadata: Metadata = {
  title: isStaging ? '[Staging] My Bookings — BizHaus' : 'My Bookings — BizHaus',
  icons: {
    icon: '/favicon-green.svg',
  },
}

export default function MyBookingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-gray-200 min-h-16 flex items-center flex-shrink-0 px-4 sm:px-6 gap-2 flex-wrap py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <a href="https://bizhaus.com" className="flex-shrink-0"><img src="/brand/bizhaus-logo.png" alt="BizHaus" className="h-5 w-auto" /></a>
        <span className="text-xs font-bold bg-booking-600 text-white px-2.5 py-1 rounded flex-shrink-0">Bookings</span>
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
