'use client'

import { useEffect, useRef } from 'react'

export default function PageVisitTracker({ path }: { path: string }) {
  const visitIdRef = useRef<string | null>(null)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    let cancelled = false

    fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled && data.id) visitIdRef.current = data.id })
      .catch(() => {})

    function sendUpdate() {
      if (!visitIdRef.current) return
      const duration_seconds = Math.round((Date.now() - startRef.current) / 1000)
      const blob = new Blob(
        [JSON.stringify({ duration_seconds })],
        { type: 'application/json' }
      )
      navigator.sendBeacon(`/api/analytics/visit/${visitIdRef.current}`, blob)
    }

    const heartbeat = setInterval(sendUpdate, 15000)

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') sendUpdate()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', sendUpdate)

    return () => {
      cancelled = true
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', sendUpdate)
      sendUpdate()
    }
  }, [path])

  return null
}
