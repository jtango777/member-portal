import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'

const PT = 'America/Los_Angeles'

/** UTC start/end for a full calendar day in Pacific Time (handles DST automatically) */
export function getPacificDayBounds(dateStr: string): { start: Date; end: Date } {
  // Probe noon UTC on that date — safely away from any DST transition hour
  const probe = new Date(`${dateStr}T12:00:00Z`)
  const ptHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: PT, hour: '2-digit', hour12: false })
      .formatToParts(probe)
      .find(p => p.type === 'hour')!.value
  )
  const offsetMs = (12 - ptHour) * 3600000 // e.g. 12 - 5 = 7h for PDT
  const midnight = new Date(`${dateStr}T00:00:00Z`).getTime() + offsetMs
  return { start: new Date(midnight), end: new Date(midnight + 86400000 - 1) }
}

/** UTC start/end for a full calendar month in Pacific Time */
export function getPacificMonthBounds(monthStr: string): { start: string; end: string } {
  const [year, month] = monthStr.split('-').map(Number)
  const { start }     = getPacificDayBounds(`${monthStr}-01`)
  const nextYear      = month === 12 ? year + 1 : year
  const nextMonth     = month === 12 ? 1 : month + 1
  const { start: nextStart } = getPacificDayBounds(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  )
  return { start: start.toISOString(), end: new Date(nextStart.getTime() - 1).toISOString() }
}

export function toPacificDate(date: Date): Date {
  const pacific = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  return pacific
}

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
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: PT, year: 'numeric', month: '2-digit' })
    .formatToParts(date)
  const year  = parts.find(p => p.type === 'year')!.value
  const month = parts.find(p => p.type === 'month')!.value
  return getPacificMonthBounds(`${year}-${month}`)
}

export function calcHoursUsed(reservations: { start_time: string; end_time: string }[]): number {
  const totalMs = reservations.reduce((acc, r) => {
    return acc + (new Date(r.end_time).getTime() - new Date(r.start_time).getTime())
  }, 0)
  return Math.round((totalMs / 3600000) * 10) / 10
}

// Build time slot options for selects (30-min increments, midnight to midnight)
export function buildTimeOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const d = new Date(2000, 0, 1, h, m)
      options.push({ label: format(d, 'h:mm a'), value: `${h}:${m === 0 ? '00' : '30'}` })
    }
  }
  // Include 12:00 AM (next day midnight) as end-time option only
  options.push({ label: '12:00 AM', value: '24:00' })
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
