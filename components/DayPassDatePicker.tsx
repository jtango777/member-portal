'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, isSameDay } from '@/lib/utils'

export type DateMode = 'single' | 'range'

type Props = {
  mode: DateMode
  onModeChange: (mode: DateMode) => void
  // Single mode uses `start` only; range mode uses both. YYYY-MM-DD.
  start: string
  end: string
  onChange: (start: string, end: string) => void
}

function isWeekend(d: Date) {
  const day = getDay(d)
  return day === 0 || day === 6
}

// Day pass date picker — single day or a consecutive weekday range,
// weekends always blocked (day passes are Monday–Friday only). Modeled on
// Industrious's day-pass date picker (tabs for Single day / Multiple days,
// an explicit "Select dates" confirm step for range mode), but expands
// inline as an accordion rather than a floating popover — this page
// already uses that expand/collapse pattern for its outer sections, and a
// floating calendar was overlapping the Location/Time content below it.
export default function DayPassDatePicker({ mode, onModeChange, start, end, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(() => start ? new Date(start + 'T12:00:00') : new Date())
  // Pending range selection — only committed to `onChange` when "Select
  // dates" is clicked, so picking a first day doesn't half-apply a range.
  const [pendingStart, setPendingStart] = useState<string>('')
  const [pendingEnd, setPendingEnd] = useState<string>('')

  function handleToggle() {
    if (!open) {
      setPickerMonth(start ? new Date(start + 'T12:00:00') : new Date())
      setPendingStart(start); setPendingEnd(end)
    }
    setOpen(v => !v)
  }

  const today = new Date()

  function selectDay(day: Date) {
    const value = format(day, 'yyyy-MM-dd')
    if (mode === 'single') {
      onChange(value, value)
      setOpen(false)
      return
    }
    // Range: first click sets start, second click sets end (swapping if
    // clicked out of order), a third click starts a new range.
    if (!pendingStart || (pendingStart && pendingEnd)) {
      setPendingStart(value); setPendingEnd('')
    } else {
      if (value < pendingStart) { setPendingEnd(pendingStart); setPendingStart(value) }
      else setPendingEnd(value)
    }
  }

  function confirmRange() {
    if (!pendingStart) return
    onChange(pendingStart, pendingEnd || pendingStart)
    setOpen(false)
  }

  function clearRange() {
    setPendingStart(''); setPendingEnd('')
  }

  const displayStart = start ? new Date(start + 'T12:00:00') : null
  const displayEnd = end ? new Date(end + 'T12:00:00') : null
  const label = displayStart
    ? mode === 'single' || !displayEnd || isSameDay(displayStart, displayEnd)
      ? format(displayStart, 'MMM d, yyyy')
      : `${format(displayStart, 'MMM d, yyyy')} to ${format(displayEnd, 'MMM d, yyyy')}`
    : 'Select date'

  const rangeStart = pendingStart ? new Date(pendingStart + 'T12:00:00') : null
  const rangeEnd = pendingEnd ? new Date(pendingEnd + 'T12:00:00') : null

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
            {/* Mode tabs */}
            <div className="flex border-b border-gray-100 mb-3">
              {(['single', 'range'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { onModeChange(m); clearRange() }}
                  className={cn(
                    'flex-1 text-sm font-semibold pb-2 border-b-2 -mb-px transition-colors',
                    mode === m ? 'text-booking-700 border-booking-600' : 'text-gray-400 border-transparent hover:text-gray-600'
                  )}
                >
                  {m === 'single' ? 'Single day' : 'Multiple days'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {mode === 'single' ? 'Select a single date to reserve' : 'Select a consecutive date range to reserve'}
            </p>

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
                const disabled = isPast || weekend

                const isSingleSelected = mode === 'single' && displayStart && isSameDay(day, displayStart)
                const inPendingRange = mode === 'range' && rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd
                const isPendingEdge = mode === 'range' && ((rangeStart && isSameDay(day, rangeStart)) || (rangeEnd && isSameDay(day, rangeEnd)))

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && selectDay(day)}
                    className={cn(
                      'text-center text-xs py-1.5 transition-colors',
                      isPendingEdge ? 'rounded-md' : inPendingRange ? 'rounded-none' : 'rounded-md',
                      disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSingleSelected || isPendingEdge
                        ? 'bg-booking-600 text-white font-semibold'
                        : inPendingRange
                        ? 'bg-booking-100 text-booking-700'
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

            {mode === 'range' && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <button type="button" onClick={clearRange} className="text-sm font-medium text-booking-600 hover:text-booking-700">
                  Clear dates
                </button>
                <button type="button" onClick={confirmRange} disabled={!pendingStart}
                  className="bg-booking-600 hover:bg-booking-700 disabled:bg-booking-300 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors">
                  Select dates
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
