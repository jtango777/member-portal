import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import DevBanner from '@/components/DevBanner'
import { isStaging } from '@/lib/isStaging'
import './globals.css'

export const metadata: Metadata = {
  title: isStaging ? '[Staging] BizHaus Member Portal' : 'BizHaus Member Portal',
  description: 'BizHaus Member Portal',
  icons: {
    icon: isStaging ? '/favicon-staging.svg' : '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DevBanner />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#ffffff',
              color: '#1f2937',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: '#ffffff' },
              style: { border: '1px solid #bbf7d0', background: '#f0fdf4' },
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
              style: { border: '1px solid #fecaca', background: '#fef2f2' },
            },
          }}
        />
      </body>
    </html>
  )
}
