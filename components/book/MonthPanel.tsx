'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, isSameDay } from '@/lib/utils'

/**
 * A month on the page, not behind a button.
 *
 * The calendar view had only day arrows and a dropdown date field, so the
 * one thing a visitor most needs to know — which days this building takes
 * bookings on at all — was only discoverable by landing on a Saturday and
 * reading the warning, or by hovering a greyed day in the popup picker
 * (Caroline, 2026-11-20). Here every closed day is simply greyed, all
 * month, with no hover needed.
 */
export default function MonthPanel({
  value, onChange, maxDate, dayUnavailable,
}: {
  /** The selected day, YYYY-MM-DD. */
  value: string
  onChange: (value: string) => void
  /** Last bookable day, YYYY-MM-DD. */
  maxDate?: string
  /** Why a day cannot be booked, or null if it can. */
  dayUnavailable?: (date: string) => string | null
}) {
  const [month, setMonth] = useState(() => new Date(value + 'T12:00:00'))
  const today = new Date()
  const selected = new Date(value + 'T12:00:00')

  const atFirstMonth =
    month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear()
  const atLastMonth =
    !!maxDate && format(startOfMonth(addMonths(month, 1)), 'yyyy-MM-dd') > maxDate

  return (
    <div className="bg-white rounded-xl ring-1 ring-gray-200/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonth(m => subMonths(m, 1))}
          disabled={atFirstMonth}
          aria-label="Previous month"
          className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        ><ChevronLeft size={14} /></button>
        <span className="text-sm font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setMonth(m => addMonths(m, 1))}
          disabled={atLastMonth}
          aria-label="Next month"
          className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        ><ChevronRight size={14} /></button>
      </div>

      <div className="grid grid-cols-7">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: getDay(startOfMonth(month)) }).map((_, i) => <div key={`pad-${i}`} />)}
        {eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).map(day => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const past = isBefore(day, startOfDay(today))
          const tooFar = !!maxDate && dayStr > maxDate
          const reason = dayUnavailable?.(dayStr) ?? null
          const blocked = past || tooFar || !!reason
          const isSelected = isSameDay(day, selected)
          return (
            <button
              key={dayStr}
              type="button"
              disabled={blocked}
              title={reason ?? undefined}
              onClick={() => onChange(dayStr)}
              className={cn(
                'text-center text-xs py-1.5 rounded-md transition-colors',
                blocked
                  ? 'text-gray-300 cursor-not-allowed'
                  : isSelected
                  ? 'bg-booking-600 text-white font-semibold'
                  : isSameDay(day, today)
                  ? 'bg-booking-50 text-booking-700 font-semibold hover:bg-booking-100'
                  : 'text-gray-700 hover:bg-gray-100',
                // A closed day that is nonetheless the day on screen still
                // has to look like the day on screen, or the grid and the
                // month disagree about where you are.
                blocked && isSelected && 'ring-1 ring-gray-300 text-gray-400',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      <p className="mt-2.5 pt-2.5 border-t border-gray-100 text-[11px] leading-snug text-gray-500">
        Greyed days cannot be booked online. Weekends can be arranged by phone;
        holidays we are closed.
      </p>
    </div>
  )
}
