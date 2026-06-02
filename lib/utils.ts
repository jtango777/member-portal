import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(date: Date): string {
  return format(date, 'h:mm a')
}

export function formatDate(date: Date): string {
  return format(date, 'EEEE, MMMM d, yyyy')
}

export function formatShortDate(date: Date): string {
  return format(date, 'MMM d, yyyy')
}

export function formatMonthYear(date: Date): string {
  return format(date, 'MMMM yyyy')
}

export function getMonthBounds(date: Date) {
  return {
    start: startOfMonth(date).toISOString(),
    end: endOfMonth(date).toISOString(),
  }
}

export function calcHoursUsed(reservations: { start_time: string; end_time: string }[]): number {
  const totalMs = reservations.reduce((acc, r) => {
    return acc + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime())
  }, 0)
  return Math.round((totalMs / 3600000) * 10) / 10
}

// Build time slot options for selects (30-min increments, 7am–10pm)
export function buildTimeOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = []
  for (let h = 7; h < 22; h++) {
    for (const m of [0, 30]) {
      const d = new Date(2000, 0, 1, h, m)
      options.push({ label: format(d, 'h:mm a'), value: `${h}:${m === 0 ? '00' : '30'}` })
    }
  }
  // Include 10pm as end-time option only
  options.push({ label: '10:00 PM', value: '22:00' })
  return options
}

export function parseTimeValue(dateStr: string, timeVal: string): Date {
  const [h, m] = timeVal.split(':').map(Number)
  // Parse YYYY-MM-DD parts directly to avoid UTC-midnight timezone shift
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, h, m, 0, 0)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function generateToken(): string {
  return crypto.randomUUID()
}
