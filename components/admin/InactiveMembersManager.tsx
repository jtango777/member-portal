'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Search, ArrowUp, ArrowDown, ArrowUpDown, Trash2 } from 'lucide-react'
import { formatShortDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type MemberRow = {
  id:                  string
  email:               string
  company_name:        string
  invited_at:          string
  accepted_at:         string | null
  full_name:           string | null
  default_location_id: string | null
  is_active:           boolean
}

export default function InactiveMembersManager() {
  const [members, setMembers]   = useState<MemberRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null)
  const [purging, setPurging] = useState<string | null>(null)
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationSort, setLocationSort] = useState<'asc' | 'desc' | null>(null)

  const refresh = useCallback(async () => {
    const r = await fetch('/api/admin/members/details')
    setMembers(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
  }, [])

  function toggleLocationSort() {
    setLocationSort(s => s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc')
  }

  function locationName(id: string | null) {
    return id ? (locations.find(l => l.id === id)?.name ?? '') : ''
  }

  async function handleRestore(memberId: string) {
    setRestoring(memberId)
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: true }),
    })
    if (res.ok) {
      toast.success('Member restored')
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setRestoring(null)
  }

  async function handlePurge(memberId: string) {
    setPurging(memberId)
    const res = await fetch(`/api/admin/members/${memberId}/purge`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Member permanently removed')
      setConfirmPurge(null)
      await refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setPurging(null)
  }

  const q = search.toLowerCase()
  let inactive = members.filter(m => m.is_active === false && (
    !q || m.email.toLowerCase().includes(q) || (m.full_name ?? '').toLowerCase().includes(q) || m.company_name.toLowerCase().includes(q)
  ))
  if (locationSort) {
    const dir = locationSort === 'asc' ? 1 : -1
    inactive = [...inactive].sort((a, b) => {
      const an = locationName(a.default_location_id)
      const bn = locationName(b.default_location_id)
      if (!an && !bn) return 0
      if (!an) return 1
      if (!bn) return -1
      return an.localeCompare(bn) * dir
    })
  }

  const SortIcon = locationSort === 'asc' ? ArrowUp : locationSort === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <div className="space-y-5">
      <div>
        <Link href="/dashboard/admin/members" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft size={14} /> Back to Members
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Archived Members</h1>
        <p className="text-sm text-gray-500 mt-0.5">{loading ? '…' : `${inactive.length} archived`}</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Search by name, email, or company…" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[16%]" /><col className="w-[22%]" /><col className="w-[18%]" /><col className="w-[12%]" /><col className="w-[9%]" /><col className="w-[23%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Name</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Email</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Company</th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">
                <button onClick={toggleLocationSort} className="flex items-center gap-1 hover:text-gray-700">
                  Location <SortIcon size={11} />
                </button>
              </th>
              <th className="text-left font-semibold text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {inactive.map(m => (
              <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 truncate" title={m.full_name ?? undefined}>{m.full_name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 truncate" title={m.email}>{m.email}</td>
                <td className="px-4 py-3 text-gray-600 truncate" title={m.company_name}>{m.company_name}</td>
                <td className="px-4 py-3 text-gray-600 truncate text-xs">
                  {m.default_location_id ? (locations.find(l => l.id === m.default_location_id)?.name ?? '—') : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{m.accepted_at ? `Joined ${formatShortDate(new Date(m.accepted_at))}` : 'Never joined'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {confirmPurge === m.id ? (
                      <>
                        <span className="text-xs text-red-700 font-medium whitespace-nowrap">Delete forever?</span>
                        <button onClick={() => handlePurge(m.id)} disabled={purging === m.id}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-2 py-1 rounded-md disabled:opacity-50">
                          {purging === m.id ? '…' : 'Yes'}
                        </button>
                        <button onClick={() => setConfirmPurge(null)} className="text-xs text-gray-400 hover:text-gray-600">No</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleRestore(m.id)} disabled={restoring === m.id}
                          className="flex items-center gap-1.5 text-xs bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-medium px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50">
                          <RotateCcw size={12} /> {restoring === m.id ? '…' : 'Restore'}
                        </button>
                        <button onClick={() => setConfirmPurge(m.id)}
                          className="flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-medium px-2.5 py-1.5 rounded-md transition-colors">
                          <Trash2 size={12} /> Remove
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && inactive.length === 0 && (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            {search ? 'No archived members match your search.' : 'No archived members.'}
          </div>
        )}
      </div>
    </div>
  )
}
