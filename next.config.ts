import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // The booking account pages moved out from under /day-pass (they cover
  // room bookings too). Keep old links — e.g. in confirmation emails
  // already sent — working.
  async redirects() {
    return [
      { source: '/day-pass/account', destination: '/my-bookings', permanent: false },
      { source: '/day-pass/login', destination: '/my-bookings/login', permanent: false },
    ]
  },
}

export default nextConfig
