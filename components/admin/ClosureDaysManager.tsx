'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Trash2, ChevronRight } from 'lucide-react'
import { AdminTable, Th, tdBase, tdNowrap, Section } from './AdminTable'
import MiniDatePicker from '@/components/MiniDatePicker'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// Days BizHaus is closed, one list per product: day passes live on the Day
// Passes page, conference rooms on Room Settings (Caroline, 2026-09-25). The
// same date can be on both lists; removing it here only affects this one.

type Closure = { date: string; name: string; blocks_day_pass: boolean; blocks_rooms: boolean }

const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

export default function ClosureDaysManager({ product }: { product: 'day_pass' | 'rooms' }) {
  const what      = product === 'day_pass' ? 'day passes' : 'conference rooms'
  const elsewhere = product === 'day_pass' ? 'conference rooms' : 'day passes'
  const otherKey  = product === 'day_pass' ? 'blocks_rooms' : 'blocks_day_pass'

  const [closures, setClosures] = useState<Closure[]>([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  // Folded by default: the list is long and rarely the reason you're here.
  const [open, setOpen] = useState(false)
  const [newDate, setNewDate]   = useState('')
  const [newName, setNewName]   = useState('')
  const [adding, setAdding]     = useState(false)

  async function load() {
    const res = await fetch(`/api/admin/closures?product=${product}`)
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Could not load the closed days'); setLoading(false); return }
    setClosures(data.closures)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!newDate || !newName.trim()) { toast.error('Pick a date and give it a name'); return }
    setAdding(true)
    const res = await fetch('/api/admin/closures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, name: newName, product }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { toast.error(data.error ?? 'Could not add that day'); return }
    setNewDate(''); setNewName('')
    toast.success(`Closed for ${what}`)
    load()
  }

  async function remove(c: Closure) {
    const label = format(new Date(c.date + 'T12:00:00'), 'MMM d, yyyy')
    if (!confirm(`Open ${label} back up for ${what}?`)) return
    setBusy(c.date)
    const res = await fetch(`/api/admin/closures?date=${c.date}&product=${product}`, { method: 'DELETE' })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) { toast.error(data.error ?? 'Could not remove that day'); return }
    setClosures(list => list.filter(x => x.date !== c.date))
    toast.success(data.stillClosedForOther ? `Open for ${what}, still closed for ${elsewhere}` : 'Removed')
  }

  const today    = todayStr()
  const upcoming = closures.filter(c => c.date >= today)
  const past     = closures.filter(c => c.date <  today)
  const shown    = showPast ? closures : upcoming

  const title = product === 'day_pass' ? 'Closed Days — Day Passes' : 'Closed Days — Conference Rooms'

  if (loading) {
    return <Section title={title}><div className="px-4 py-6 text-sm text-gray-400">Loading…</div></Section>
  }

  return (
    <Section title={`${title} (${upcoming.length} upcoming)`}>
      <div className="px-4 py-4 flex flex-col gap-4">
        <p className="text-sm text-gray-500 max-w-2xl">
          Nobody can book {what} on these days. They show as greyed out with the reason,
          so customers know why. This list is just for {what}; {elsewhere} are set separately
          on their own page.
        </p>

        {/* Adding a day is the thing staff come here to do, so it sits at the
            top and the list folds away underneath (Caroline, 2026-09-25). */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <MiniDatePicker
              value={newDate}
              onChange={setNewDate}
              accent="blue"
              placeholder="Pick a date"
              dayUnavailable={d =>
                d < today ? 'That date has already passed.'
                : closures.some(c => c.date === d) ? 'Already closed.'
                : null}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">What is it?</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Staff offsite"
              className="w-56 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={add}
            disabled={adding}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {adding ? 'Adding…' : 'Add day'}
          </button>
          <p className="text-xs text-gray-400 basis-full">
            Bookings already on that day aren&apos;t cancelled, so check the calendar first if
            you&apos;re closing a day someone has booked.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronRight size={15} className={cn('transition-transform duration-200', open ? 'rotate-90' : 'rotate-0')} />
            {open ? 'Hide' : 'Show'} the {upcoming.length} closed day{upcoming.length === 1 ? '' : 's'} coming up
          </button>

          <div className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            open ? 'opacity-100 mt-3' : 'max-h-0 opacity-0'
          )}>
            <AdminTable colWidths={['1fr', '220px', '150px', '80px']} minWidth={640}>
              <thead>
                <tr>
                  <Th>Day</Th>
                  <Th>Date</Th>
                  <Th>Also closed for</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map(c => (
                  <tr key={c.date} className={cn('hover:bg-gray-50', c.date < today && 'opacity-50')}>
                    <td className={cn(tdBase, 'font-medium text-gray-900')}>{c.name}</td>
                    <td className={tdNowrap}>{format(new Date(c.date + 'T12:00:00'), 'EEE, MMM d, yyyy')}</td>
                    <td className={cn(tdNowrap, 'text-gray-400 text-xs')}>
                      {(c as unknown as Record<string, boolean>)[otherKey] ? elsewhere : '—'}
                    </td>
                    <td className={cn(tdNowrap, 'text-right')}>
                      <button
                        onClick={() => remove(c)}
                        disabled={busy === c.date}
                        title={`Open this day back up for ${what}`}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No closed days coming up.</td></tr>
                )}
              </tbody>
            </AdminTable>

            {past.length > 0 && (
              <button onClick={() => setShowPast(v => !v)} className="mt-3 text-sm text-blue-600 hover:text-blue-800">
                {showPast ? 'Hide past days' : `Show ${past.length} past day${past.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}
