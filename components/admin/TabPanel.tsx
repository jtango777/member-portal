'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// Tab content that eases in instead of snapping, the same feel as the
// accordions on the day pass and booking pages (Caroline, 2026-09-25).
//
// Keyed on the active tab: every switch remounts this, so the panel starts
// slightly low and transparent and settles on the next frame. `motion-safe`
// leaves it still for anyone who asks their system for less motion.
export default function TabPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className={cn(
        'motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-out',
        shown ? 'opacity-100 translate-y-0' : 'motion-safe:opacity-0 motion-safe:translate-y-1',
        className,
      )}
    >
      {children}
    </div>
  )
}
