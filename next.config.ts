import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Deploys are gated on the typechecker again (2026-10-01).
  //
  // This was `ignoreBuildErrors: true`, which meant Vercel compiled, saw the
  // errors, and shipped anyway. It cost us: a `phone` argument used but never
  // destructured broke account creation for every new day pass customer, and
  // the build that deployed it had already caught it and been told not to
  // care. Turning this back on means a build that does not typecheck does not
  // reach customers.
  //
  // There was an `eslint: { ignoreDuringBuilds: true }` here too. Next 16
  // removed that option entirely, so it had stopped doing anything.
  typescript: {
    ignoreBuildErrors: false,
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
