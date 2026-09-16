'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, isSameDay } from '@/lib/utils'
import { MAX_DAY_PASS_DAYS } from '@/lib/dayPass'

type Props = {
  // Any number of dates, in any combination — not necessarily consecutive.
  // YYYY-MM-DD strings.
  selected: string[]
  onChange: (dates: string[]) => void
}

function isWeekend(d: Date) {
  const day = getDay(d)
  return day === 0 || day === 6
}

function toDate(s: string) {
  return new Date(s + 'T12:00:00')
}

// Day pass date picker — single day or any combination of weekday dates,
// weekends always blocked (day passes are Monday–Friday only). "Multiple
// days" is a true multi-select — every click toggles just that one day,
// there's no forced fill between a first and last pick — Caroline hit
// this directly (2026-08-31): she wanted the 15th and the 30th with
// nothing in between, and the old range-only picker couldn't do that.
// Modeled on Industrious's day-pass date picker (tabs for Single day /
// Multiple days, an explicit "Select dates" confirm step for multi-select),
// but expands inline as an accordion rather than a floating popover — this
// page already uses that expand/collapse pattern for its outer sections,
// and a floating calendar was overlapping the Location/Time content below it.
// One picker, no modes: pick one day for one day, pick several for several.
// It used to have Single day / Multiple days tabs, which made choosing a
// single date a two-step decision for no reason (Caroline, 2026-09-16).
export default function DayPassDatePicker({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(() => selected[0] ? toDate(selected[0]) : new Date())
  // Pending selection — only committed to `onChange` when "Select dates"
  // is clicked (multiple mode), so picking one day doesn't half-apply.
  const [pending, setPending] = useState<string[]>(selected)

  function handleToggle() {
    if (!open) {
      setPickerMonth(selected[0] ? toDate(selected[0]) : new Date())
      setPending(selected)
    }
    setOpen(v => !v)
  }

  const today = new Date()

  function selectDay(day: Date) {
    const value = format(day, 'yyyy-MM-dd')
    // Toggle this exact day in or out, independent of anything else picked.
    setPending(prev => {
      if (prev.includes(value)) return prev.filter(d => d !== value)
      // Capped — see the note above the calendar.
      if (prev.length >= MAX_DAY_PASS_DAYS) return prev
      return [...prev, value].sort()
    })
  }

  function confirmSelection() {
    if (!pending.length) return
    onChange(pending)
    setOpen(false)
  }

  function clearSelection() {
    setPending([])
  }

  const sortedSelected = [...selected].sort()
  const label = sortedSelected.length === 0
    ? 'Select date'
    : sortedSelected.length === 1
    ? format(toDate(sortedSelected[0]), 'MMM d, yyyy')
    : `${sortedSelected.length} days selected`

  return (
    <div className={cn('border rounded-lg transition-colors', open ? 'border-booking-600' : 'border-gray-300')}>
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-sm bg-white hover:bg-gray-50 transition-colors rounded-lg"
      >
        <span className="flex-1">{label}</span>
        <ChevronRight size={14} className={cn('text-gray-400 transition-transform', open && 'rotate-90')} />
      </button>

      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-in-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className={cn('overflow-hidden transition-opacity duration-200', open ? 'opacity-100 delay-100' : 'opacity-0')}>
          <div className="p-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">
              Pick a day — or as many as you need, they don’t have to be consecutive.
            </p>
            {/* Shown the moment the cap is reached, not only when someone
                clicks an 11th day — the greyed-out days otherwise look
                broken with no explanation (Caroline, 2026-09-16). */}
            {pending.length >= MAX_DAY_PASS_DAYS && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2 mb-2">
                {pending.length} of {MAX_DAY_PASS_DAYS} days selected — that’s the most you can book at once.
                Unpick a day to swap it, or email{' '}
                <a href="mailto:hello@bizhaus.com" className="underline">hello@bizhaus.com</a> for a longer stay.
              </p>
            )}

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2">
              <button type="button"
                onClick={() => setPickerMonth(m => subMonths(m, 1))}
                disabled={pickerMonth.getMonth() === today.getMonth() && pickerMonth.getFullYear() === today.getFullYear()}
                className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm font-semibold text-gray-900">{format(pickerMonth, 'MMMM yyyy')}</span>
              <button type="button" onClick={() => setPickerMonth(m => addMonths(m, 1))}
                className="p-1 hover:bg-gray-100 rounded transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: getDay(startOfMonth(pickerMonth)) }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {eachDayOfInterval({ start: startOfMonth(pickerMonth), end: endOfMonth(pickerMonth) }).map(day => {
                const isPast = isBefore(day, startOfDay(today))
                const weekend = isWeekend(day)
                const atLimit = pending.length >= MAX_DAY_PASS_DAYS && !pending.includes(format(day, 'yyyy-MM-dd'))
                const disabled = isPast || weekend || atLimit
                const value = format(day, 'yyyy-MM-dd')

                const isSelected = pending.includes(value)

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    // Not `disabled` when only the limit is the reason —
                    // a click still needs to explain why it can't be added.
                    disabled={isPast || weekend}
                    onClick={() => {
                      if (isPast || weekend) return
                      if (atLimit) return
                      selectDay(day)
                    }}
                    className={cn(
                      'text-center text-xs py-1.5 rounded-md transition-colors',
                      disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSelected
                        ? 'bg-booking-600 text-white font-semibold'
                        : isSameDay(day, today)
                        ? 'bg-booking-50 text-booking-600 font-semibold'
                        : 'hover:bg-gray-100 text-gray-700'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={clearSelection} className="text-sm font-medium text-booking-600 hover:text-booking-700">
                  Clear dates
                </button>
                <button type="button" onClick={confirmSelection} disabled={!pending.length}
                  className="bg-booking-600 hover:bg-booking-700 disabled:bg-booking-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors">
                {pending.length ? `Select ${pending.length} day${pending.length > 1 ? 's' : ''}` : 'Select dates'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
