'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A dropdown with our own arrow rather than the browser's.
 *
 * Left as a bare <select>, the chevron is drawn by the browser, which
 * also decides where to put it: Chrome jams it against the right inner
 * edge, ignoring the padding that holds the text in, and Safari and
 * Firefox each draw something different. On the half-width time fields
 * that reads as an arrow shoved into the corner (Caroline, 2026-11-18).
 *
 * appearance-none turns the browser's arrow off, and the lucide chevron
 * here is the same one used on the room expander and the date arrows, so
 * every control on the page points with the same shape. pr-9 keeps the
 * text clear of it, and pointer-events-none on the icon means clicking
 * the arrow still opens the list.
 */
export default function SelectField({
  className, children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          'w-full appearance-none rounded-lg border bg-white pl-3 pr-9 py-2 text-sm',
          'focus:outline-none focus:ring-2',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400',
          props.disabled && 'opacity-40',
        )}
      />
    </div>
  )
}
