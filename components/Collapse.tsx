'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Something that opens and shuts instead of appearing and vanishing.
 *
 * One component so every expander on the booking pages moves the same
 * way. The room details expander did this by hand with max-h-40, which
 * works until the content is taller than the guess and then silently
 * clips it. This animates grid-template-rows from 0fr to 1fr, which the
 * browser resolves to the real height of whatever is inside, so nothing
 * has to be guessed and nothing gets cut off (Caroline, 2026-11-18).
 *
 * `inert` while shut, so a collapsed panel's buttons and selects are not
 * reachable by tab or by a stray click: the content is still in the page,
 * it is just zero pixels tall.
 */
export default function Collapse({
  open, children, className, duration = 300,
}: {
  open: boolean
  children: React.ReactNode
  className?: string
  /** Milliseconds. Shorter for small swaps, the default for panels. */
  duration?: number
}) {
  /**
   * Clip while moving, and only while moving.
   *
   * The height animation needs overflow hidden or the content spills out
   * of a box that is still growing. But leaving it on at rest cuts off
   * anything a child draws outside its own edges, and the first thing
   * that hit was the focus ring on the time dropdowns: they sit flush
   * against this wrapper, so the ring was sliced away on the outer and
   * bottom edges and left showing on the inner one. It read as a stray
   * green sliver rather than a ring (Caroline, 2026-11-18).
   */
  const [moving, setMoving] = useState(false)
  useEffect(() => {
    setMoving(true)
    const t = setTimeout(() => setMoving(false), duration)
    return () => clearTimeout(t)
  }, [open, duration])

  return (
    <div
      inert={!open}
      style={{ transitionDuration: `${duration}ms` }}
      className={cn(
        'grid transition-[grid-template-rows,opacity] ease-in-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
    >
      <div className={cn('min-h-0', (!open || moving) && 'overflow-hidden')}>{children}</div>
    </div>
  )
}
