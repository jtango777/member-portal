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
    <div className="bg-slate-600 text-white text-center text-xs font-bold py-1 px-2 tracking-wide">
      Staging environment — not live
    </div>
  )
}
