'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Search } from 'lucide-react'
import { Company } from '@/types'
import toast from 'react-hot-toast'

export default function InactiveCompaniesManager() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/companies?status=inactive')
    setCompanies(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleRestore(id: string) {
    setRestoring(id)
    const res = await fetch(`/api/admin/companies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    })
    if (res.ok) {
      toast.success('Company restored')
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to restore')
    }
    setRestoring(null)
  }

  const q = search.trim().toLowerCase()
  const filtered = companies.filter(c => !q || c.name.toLowerCase().includes(q))

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/admin/companies" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft size={14} /> Back to Companies
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Archived Companies</h1>
        <p className="text-sm text-gray-500 mt-0.5">{loading ? '…' : `${filtered.length} archived`}</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Search by name…" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[50%]" /><col className="w-[25%]" /><col className="w-[25%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Company</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Monthly Hours</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 truncate">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.monthly_hours_allotment}h</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button onClick={() => handleRestore(c.id)} disabled={restoring === c.id}
                      className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-medium px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50">
                      <RotateCcw size={12} /> {restoring === c.id ? '…' : 'Restore'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            {search ? 'No archived companies match your search.' : 'No archived companies.'}
          </div>
        )}
      </div>
    </div>
  )
}
