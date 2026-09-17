'use client'

import { useEffect, useState } from 'react'

// The header's "Log in" vs "My Bookings" link. This is a client component
// purely so it can react to the in-page login dialog: the day-pass checkout
// signs people in without navigating (so they don't lose the days they
// picked), which left the server-rendered header saying "Have an account?
// Log in" to someone who had just logged in (Caroline, 2026-09-17).
//
// `initial` comes from the server render, so the correct link is there on
// first paint with no flicker; the listener only matters after an in-page
// login fires the event below.
export const AUTH_CHANGED_EVENT = 'bizhaus:booking-auth-changed'

export default function HeaderAccountLink({ initial }: { initial: boolean }) {
  const [isCustomer, setIsCustomer] = useState(initial)

  useEffect(() => {
    function recheck() {
      fetch('/api/day-pass/my-account')
        .then(res => res.json())
        .then(data => setIsCustomer(!!data.customer))
        .catch(() => {})
    }
    window.addEventListener(AUTH_CHANGED_EVENT, recheck)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, recheck)
  }, [])

  if (isCustomer) {
    return <a href="/my-bookings" className="text-sm text-booking-700 font-medium hover:underline whitespace-nowrap">My Bookings</a>
  }
  return (
    <span className="text-sm text-gray-500 whitespace-nowrap">
      <span className="hidden sm:inline">Have an account? </span>
      <a href="/my-bookings/login" className="text-booking-700 font-medium hover:underline">Log in</a>
    </span>
  )
}
