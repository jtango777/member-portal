'use client'

import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, isSameDay } from '@/lib/utils'

type Props = {
  value: string       // YYYY-MM-DD
  onChange: (value: string) => void
  disabled?: boolean
}

export default function MiniDatePicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(() => value ? new Date(value + 'T12:00:00') : new Date())
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedDate = value ? new Date(value + 'T12:00:00') : null
  const today = new Date()

  function selectDay(day: Date) {
    onChange(format(day, 'yyyy-MM-dd'))
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setPickerMonth(selectedDate ?? new Date()); setOpen(v => !v) } }}
        className={cn(
          'w-full text-left border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors',
          disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer',
        )}
      >
        {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select date'}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-64">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setPickerMonth(m => subMonths(m, 1))}
              className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-semibold text-gray-900">{format(pickerMonth, 'MMMM yyyy')}</span>
            <button type="button" onClick={() => setPickerMonth(m => addMonths(m, 1))}
              className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: getDay(startOfMonth(pickerMonth)) }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {eachDayOfInterval({ start: startOfMonth(pickerMonth), end: endOfMonth(pickerMonth) }).map(day => (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => selectDay(day)}
                className={cn(
                  'text-center text-xs py-1.5 rounded-md transition-colors',
                  selectedDate && isSameDay(day, selectedDate)
                    ? 'bg-blue-600 text-white font-semibold'
                    : isSameDay(day, today)
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'hover:bg-gray-100 text-gray-700'
                )}
              >
                {format(day, 'd')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
