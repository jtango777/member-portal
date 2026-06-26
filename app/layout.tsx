import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import DevBanner from '@/components/DevBanner'
import './globals.css'

export const metadata: Metadata = {
  title: 'BizHaus Room Bookings',
  description: 'Room Reservation System',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DevBanner />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
