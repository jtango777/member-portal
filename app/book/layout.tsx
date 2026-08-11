import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book a Meeting Room — BizHaus',
  description: 'Reserve a professional meeting room by the hour at BizHaus. No membership required.',
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-slate-900 h-16 flex items-center flex-shrink-0 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bizhaus-logo-white.png" alt="BizHaus" className="h-5 w-auto" />
        <span className="ml-2.5 text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">Member Portal</span>
        <span className="ml-2 text-sm font-medium text-slate-400">Bookings</span>
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
