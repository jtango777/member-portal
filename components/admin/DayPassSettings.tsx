'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Section } from './AdminTable'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// Price and closure days, editable here instead of in the code (Caroline,
// 2026-09-25). Both take effect on the public sites within seconds; the
// booking routes re-read them before taking any payment, so nothing has to
// be redeployed.

type Closure = { date: string; name: string; blocks_day_pass: boolean; blocks_rooms: boolean }

const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date())

export default function DayPassSettings() {
  const [price, setPrice]       = useState('')
  const [savedPrice, setSaved]  = useState<number | null>(null)
  const [closures, setClosures] = useState<Closure[]>([])
  const [loading, setLoading]   = useState(true)
  const [savingPrice, setSavingPrice] = useState(false)
  const [busyDate, setBusyDate] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)

  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [newDayPass, setNewDayPass] = useState(true)
  const [newRooms, setNewRooms] = useState(true)
  const [adding, setAdding] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/day-pass-settings')
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Could not load settings'); setLoading(false); return }
    setSaved(data.priceCents)
    setPrice((data.priceCents / 100).toString())
    setClosures(data.closures)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function savePrice() {
    const dollars = Number(price)
    if (!Number.isFinite(dollars) || dollars <= 0) { toast.error('Enter a price like 30 or 32.50'); return }
    setSavingPrice(true)
    const res = await fetch('/api/admin/day-pass-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_cents: Math.round(dollars * 100) }),
    })
    const data = await res.json()
    setSavingPrice(false)
    if (!res.ok) { toast.error(data.error ?? 'Could not save the price'); return }
    setSaved(data.priceCents)
    toast.success(`Day passes now cost $${(data.priceCents / 100).toFixed(2)} a day`)
  }

  async function toggle(date: string, field: 'blocks_day_pass' | 'blocks_rooms', value: boolean) {
    setBusyDate(date)
    setClosures(list => list.map(c => c.date === date ? { ...c, [field]: value } : c))
    const res = await fetch('/api/admin/closures', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, [field]: value }),
    })
    setBusyDate(null)
    if (!res.ok) {
      setClosures(list => list.map(c => c.date === date ? { ...c, [field]: !value } : c))
      toast.error((await res.json()).error ?? 'Could not save that change')
    }
  }

  async function addClosure() {
    if (!newDate || !newName.trim()) { toast.error('Pick a date and give it a name'); return }
    setAdding(true)
    const res = await fetch('/api/admin/closures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, name: newName, blocks_day_pass: newDayPass, blocks_rooms: newRooms }),
    })
    const data = await res.json()
    setAdding(false)
    if (!res.ok) { toast.error(data.error ?? 'Could not add that day'); return }
    setNewDate(''); setNewName(''); setNewDayPass(true); setNewRooms(true)
    toast.success('Closed day added')
    load()
  }

  async function remove(date: string, name: string) {
    if (!confirm(`Remove ${name} (${format(new Date(date + 'T12:00:00'), 'MMM d, yyyy')}) from the list? That day becomes bookable again.`)) return
    setBusyDate(date)
    const res = await fetch(`/api/admin/closures?date=${date}`, { method: 'DELETE' })
    setBusyDate(null)
    if (!res.ok) { toast.error((await res.json()).error ?? 'Could not remove that day'); return }
    setClosures(list => list.filter(c => c.date !== date))
    toast.success('Removed')
  }

  const today = todayStr()
  const upcoming = closures.filter(c => c.date >= today)
  const past     = closures.filter(c => c.date <  today)
  const shown    = showPast ? closures : upcoming

  if (loading) return <Section title="Settings"><div className="px-4 py-6 text-sm text-gray-400">Loading…</div></Section>

  return (
    <div className="flex flex-col gap-4">
      <Section title="Day Pass Price">
        <div className="px-4 py-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price per day</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">$</span>
              <input
                value={price}
                onChange={e => setPrice(e.target.value)}
                inputMode="decimal"
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={savePrice}
                disabled={savingPrice || Number(price) * 100 === savedPrice}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {savingPrice ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 max-w-md">
            Applies to new day passes straight away, on bizhaus.com and in the portal.
            Passes already bought keep the price they were sold at.
          </p>
        </div>
      </Section>

      <Section title={`Closed Days (${upcoming.length} upcoming)`}>
        <div className="px-4 py-4 flex flex-col gap-4">
          <p className="text-sm text-gray-500 max-w-2xl">
            Customers can&apos;t book these days, and they show as greyed out with the reason
            on the day pass calendar and the room booking pages. Untick a column to let that
            day be booked again, for example if the conference rooms are open on a day the
            coworking floor is closed.
          </p>

          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            <div className="grid grid-cols-[1fr_130px_130px_40px] gap-2 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div>Day</div>
              <div className="text-center">Blocks day passes</div>
              <div className="text-center">Blocks rooms</div>
              <div />
            </div>

            {shown.length === 0 && (
              <div className="px-3 py-6 text-sm text-gray-400 text-center">No closed days coming up.</div>
            )}

            {shown.map(c => {
              const isPast = c.date < today
              return (
                <div key={c.date} className={cn('grid grid-cols-[1fr_130px_130px_40px] gap-2 px-3 py-2.5 items-center', isPast && 'opacity-50')}>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500">{format(new Date(c.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}</div>
                  </div>
                  <div className="text-center">
                    <input
                      type="checkbox"
                      checked={c.blocks_day_pass}
                      disabled={busyDate === c.date}
                      onChange={e => toggle(c.date, 'blocks_day_pass', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <div className="text-center">
                    <input
                      type="checkbox"
                      checked={c.blocks_rooms}
                      disabled={busyDate === c.date}
                      onChange={e => toggle(c.date, 'blocks_rooms', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => remove(c.date, c.name)}
                    disabled={busyDate === c.date}
                    title="Remove this day"
                    className="text-gray-300 hover:text-red-500 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          {past.length > 0 && (
            <button onClick={() => setShowPast(v => !v)} className="self-start text-sm text-blue-600 hover:text-blue-800">
              {showPast ? 'Hide past days' : `Show ${past.length} past day${past.length === 1 ? '' : 's'}`}
            </button>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add a closed day</div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  min={today}
                  onChange={e => setNewDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                <input type="checkbox" checked={newDayPass} onChange={e => setNewDayPass(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Day passes
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 pb-2">
                <input type="checkbox" checked={newRooms} onChange={e => setNewRooms(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Conference rooms
              </label>
              <button
                onClick={addClosure}
                disabled={adding}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {adding ? 'Adding…' : 'Add day'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Nobody will be able to book that day for whichever of the two you tick. Existing
              bookings on that day aren&apos;t cancelled, so check the calendar if you&apos;re closing a
              day that&apos;s already been booked.
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}
