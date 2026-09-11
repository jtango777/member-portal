'use client'

import { useEffect, useState } from 'react'

export default function DevBanner() {
  const [isDev, setIsDev] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    setIsDev(
      host.includes('devrooms') ||
      host === 'localhost' ||
      host.includes('staging') ||
      host.includes('member-portal') // temporary — covers the pre-custom-domain staging URL
    )
  }, [])

  if (!isDev) return null

  return (
    <div className="portal-stripes text-center text-xs font-bold py-1.5 px-2 tracking-wide">
      <span className="bg-black/60 text-white px-2 py-0.5 rounded">
        STAGING ENVIRONMENT — not production
      </span>
    </div>
  )
}
