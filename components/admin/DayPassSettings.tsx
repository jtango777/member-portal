'use client'

import { useEffect, useState } from 'react'
import { Section } from './AdminTable'
import toast from 'react-hot-toast'

// The day pass price, editable here instead of in the code (Caroline,
// 2026-09-25). It takes effect on the public site within seconds; the
// booking routes re-read it before taking any payment, so nothing has to be
// redeployed. Closed days are their own tab, see ClosureDaysManager.

export default function DayPassSettings() {
  const [price, setPrice]       = useState('')
  const [savedPrice, setSaved]  = useState<number | null>(null)
  const [loading, setLoading]   = useState(true)
  const [savingPrice, setSavingPrice] = useState(false)
  // Door codes, per location. Only Marina is self-entry today, but the code
  // changes without warning and nobody should need a developer for it
  // (Caroline, 2026-10-01).
  const [locations, setLocations] = useState<{ id: string; name: string; door_code: string | null }[]>([])
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [savingCodes, setSavingCodes] = useState(false)

  async function load() {
    const res = await fetch('/api/admin/day-pass-settings')
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Could not load settings'); setLoading(false); return }
    setSaved(data.priceCents)
    setPrice((data.priceCents / 100).toString())
    setLocations(data.locations ?? [])
    setCodes(Object.fromEntries((data.locations ?? []).map((l: { id: string; door_code: string | null }) => [l.id, l.door_code ?? ''])))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveCodes() {
    setSavingCodes(true)
    const res = await fetch('/api/admin/day-pass-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ door_codes: codes }),
    })
    setSavingCodes(false)
    if (!res.ok) { toast.error((await res.json()).error ?? 'Could not save the door codes'); return }
    toast.success('Door codes saved. New confirmation emails will use them.')
    load()
  }

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

      <Section title="Door Codes">
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm text-gray-500 max-w-xl">
            The code a day passer uses to let themselves in, included in their confirmation email.
            Leave a location blank if someone is there to let people in.
          </p>
          <div className="flex flex-col gap-3 max-w-md">
            {locations.map(l => (
              <div key={l.id} className="flex items-center gap-3">
                <label className="text-sm text-gray-700 w-36 flex-shrink-0">{l.name}</label>
                <input
                  value={codes[l.id] ?? ''}
                  onChange={e => setCodes(c => ({ ...c, [l.id]: e.target.value }))}
                  placeholder="No code"
                  className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
          <div>
            <button
              onClick={saveCodes}
              disabled={savingCodes || locations.every(l => (codes[l.id] ?? '') === (l.door_code ?? ''))}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {savingCodes ? 'Saving…' : 'Save codes'}
            </button>
          </div>
        </div>
      </Section>

    </div>
  )
}
