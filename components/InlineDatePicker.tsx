'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, isBefore, startOfDay } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, isSameDay, parseFuzzyDate } from '@/lib/utils'
import { useAutoScrollIntoView } from '@/lib/useAutoScrollIntoView'

type Props = {
  value: string // yyyy-MM-dd, or '' for unset
  onChange: (value: string) => void
  disabled?: boolean
  disablePast?: boolean
  placeholder?: string
}

// The single shared date-field pattern used throughout the reservation form:
// a typable text input (fuzzy-parsed) plus a "Show/Hide calendar" toggle that
// unfolds an inline month grid. Anywhere a date needs picking should reuse
// this rather than growing its own bespoke picker.
export default function InlineDatePicker({ value, onChange, disabled, disablePast, placeholder = 'e.g. June 24 or 6/24/2026' }: Props) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [inputText, setInputText] = useState(value ? format(new Date(value + 'T12:00:00'), 'MMMM d, yyyy') : '')
  const [pickerMonth, setPickerMonth] = useState(() => value ? new Date(value + 'T12:00:00') : new Date())
  const calendarRef = useAutoScrollIntoView<HTMLDivElement>(showCalendar)

  function commit(date: Date) {
    onChange(format(date, 'yyyy-MM-dd'))
    setPickerMonth(date)
    setInputText(format(date, 'MMMM d, yyyy'))
  }

  function tryParseInput() {
    const parsed = parseFuzzyDate(inputText)
    if (parsed) {
      commit(parsed)
    } else if (value) {
      setInputText(format(new Date(value + 'T12:00:00'), 'MMMM d, yyyy'))
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={inputText}
        disabled={disabled}
        onChange={e => setInputText(e.target.value)}
        onBlur={tryParseInput}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            tryParseInput()
          }
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        placeholder={placeholder}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShowCalendar(v => !v)}
        className="mt-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {showCalendar ? 'Hide calendar' : 'Show calendar'}
      </button>
      <div ref={calendarRef} className={cn(
        'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        showCalendar && !disabled ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
      )}>
        <div className="overflow-hidden">
          <div className="relative bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
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
                const selected = value && isSameDay(day, new Date(value + 'T12:00:00'))
                const today = isToday(day)
                const isPast = disablePast && isBefore(day, startOfDay(new Date())) && !today
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isPast}
                    onClick={() => {
                      commit(day)
                      setShowCalendar(false)
                    }}
                    className={cn(
                      'text-center text-xs py-1.5 rounded-md transition-colors',
                      isPast
                        ? 'text-gray-300 cursor-not-allowed'
                        : selected
                        ? 'bg-blue-600 text-white font-semibold'
                        : today
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'hover:bg-gray-100 text-gray-700'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
