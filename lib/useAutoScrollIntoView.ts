import { useEffect, useRef } from 'react'

// Attach the returned ref to a section that expands open (Repeat options,
// a calendar, "Connect to Rooms" fields, etc.) — when `active` flips true,
// it smoothly scrolls that section into view so it doesn't just expand
// silently below the fold, requiring the user to notice and scroll down
// themselves. Works inside any scrollable ancestor (a modal's scrollable
// body, the page itself, etc.) since scrollIntoView finds it automatically.
//
// The short delay lets the grid-rows expand transition actually start
// growing the element first — scrolling on the very same tick would
// target its pre-expansion (still-collapsed) size.
export function useAutoScrollIntoView<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)
    return () => clearTimeout(t)
  }, [active])

  return ref
}
