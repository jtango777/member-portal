'use client'

import { useEffect, useState } from 'react'
import { Landmark } from 'lucide-react'
import toast from 'react-hot-toast'

// Where each entity's Stripe payouts are deposited in QuickBooks.
//
// The names are read from the connected company files rather than typed from
// memory: Caroline's own QuickBooks role cannot open the chart of accounts,
// and the three companies name their bank accounts differently, so a typed
// name would be a guess (2026-10-06).

type Location = { id: string; name: string }

export default function QbBankAccounts() {
  const [accounts, setAccounts] = useState<Record<string, string>>({})
  const [choices, setChoices] = useState<Record<string, string[]>>({})
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/qb-bank-accounts')
      .then(r => r.json())
      .then(d => {
        setAccounts(d.accounts ?? {})
        setChoices(d.choices ?? {})
        setLocations(d.locations ?? [])
      })
      .catch(() => toast.error('Could not load the bank accounts'))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/qb-bank-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accounts }),
    })
    if (res.ok) toast.success('Saved.')
    else toast.error((await res.json()).error ?? 'Could not save')
    setSaving(false)
  }

  if (loading) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <Landmark size={16} className="text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900">Payout bank account</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed max-w-2xl">
        When Stripe pays out, the deposit is recorded in this account, with the sales it covers
        and a line for Stripe&rsquo;s fee, so the books match the bank. Leave one blank and that
        location&rsquo;s deposits are simply not recorded.
      </p>

      <div className="flex flex-col gap-3">
        {locations.map(loc => {
          const options = choices[loc.id] ?? []
          return (
            <div key={loc.id} className="flex items-center gap-3">
              <label className="text-sm text-gray-700 w-36 flex-shrink-0">{loc.name}</label>
              {options.length > 0 ? (
                <select
                  value={accounts[loc.id] ?? ''}
                  onChange={e => setAccounts({ ...accounts, [loc.id]: e.target.value })}
                  className="flex-1 max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not set</option>
                  {options.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              ) : (
                // No list to offer: that company is not connected to
                // QuickBooks, or QuickBooks could not be reached just now.
                <input
                  value={accounts[loc.id] ?? ''}
                  onChange={e => setAccounts({ ...accounts, [loc.id]: e.target.value })}
                  placeholder="Account name, exactly as QuickBooks has it"
                  className="flex-1 max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
