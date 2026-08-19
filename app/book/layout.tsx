import type { Metadata } from 'next'
import { isStaging } from '@/lib/isStaging'

export const metadata: Metadata = {
  title: isStaging ? '[Staging] Book a Meeting Room — BizHaus' : 'Book a Meeting Room — BizHaus',
  description: 'Reserve a professional meeting room by the hour at BizHaus. No membership required.',
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center flex-shrink-0 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bizhaus-logo.png" alt="BizHaus" className="h-5 w-auto" />
        <span className="ml-4 text-xs font-bold bg-booking-600 text-white px-2.5 py-1 rounded">Bookings</span>
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
