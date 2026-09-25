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

  async function load() {
    const res = await fetch('/api/admin/day-pass-settings')
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Could not load settings'); setLoading(false); return }
    setSaved(data.priceCents)
    setPrice((data.priceCents / 100).toString())
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

    </div>
  )
}
