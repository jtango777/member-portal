'use client'

import { useEffect, useState } from 'react'

export default function DevBanner() {
  const [isDev, setIsDev] = useState(false)

  useEffect(() => {
    const host = window.location.hostname
    setIsDev(host.includes('devrooms') || host === 'localhost')
  }, [])

  if (!isDev) return null

  return (
    <div className="bg-amber-400 text-amber-900 text-center text-xs font-bold py-1 px-2 tracking-wide">
      DEV ENVIRONMENT — this is not the live site
    </div>
  )
}
