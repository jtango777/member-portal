import type { Metadata } from 'next'
import { isStaging } from '@/lib/isStaging'

export const metadata: Metadata = {
  title: isStaging ? '[Staging] Reserve a Day Pass — BizHaus' : 'Reserve a Day Pass — BizHaus',
  description: 'Reserve a coworking day pass at a BizHaus location. No membership required.',
  icons: {
    icon: '/favicon-green.svg',
  },
}

export default function DayPassLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center flex-shrink-0 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bizhaus-logo.png" alt="BizHaus" className="h-5 w-auto" />
        <span className="ml-4 text-xs font-bold bg-booking-600 text-white px-2.5 py-1 rounded">Day Pass</span>
        <div className="flex-1" />
        <span className="text-sm text-gray-500">
          Have an account? <a href="#" className="text-booking-700 font-medium hover:underline">Log in</a>
        </span>
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
