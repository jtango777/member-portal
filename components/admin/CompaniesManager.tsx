'use client'

import React, { useState, useEffect } from 'react'
import { Company, MembershipType } from '@/types'
import { Plus, Edit2, Check, X, Settings, Trash2, Search, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import EditCompanyDialog, { EditableCompany } from '@/components/admin/EditCompanyDialog'
import { AdminTable, Th, tdBase, tdTruncate, tdNowrap } from '@/components/admin/AdminTable'

type MemberUsage = {
  user_id: string | null
  email: string
  full_name: string | null
  company_id: string
  company_name: string
  hours_used: number
  reservation_count: number
  default_location_id: string | null
}

type Props = {
  companies:       Company[]
  membershipTypes: MembershipType[]
}

type TypeEditState = { id: string; name: string; hours: string } | null

export default function CompaniesManager({ companies: initial, membershipTypes: initialTypes }: Props) {
  const [companies,       setCompanies]       = useState(initial)
  const [membershipTypes, setMembershipTypes] = useState(initialTypes)
  const [showForm,        setShowForm]        = useState(false)
  const [showManageTypes, setShowManageTypes] = useState(false)
  const [newName,             setNewName]             = useState('')
  const [newHours,            setNewHours]            = useState('0')
  const [creating,            setCreating]            = useState(false)
  const [editTarget,          setEditTarget]          = useState<EditableCompany | null>(null)
  // Manage types state
  const [newTypeName,     setNewTypeName]     = useState('')
  const [newTypeHours,    setNewTypeHours]    = useState('')
  const [creatingType,    setCreatingType]    = useState(false)
  const [editingType,     setEditingType]     = useState<TypeEditState>(null)
  const [savingType,      setSavingType]      = useState(false)
  const [deletingType,    setDeletingType]    = useState<string | null>(null)

  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set())
  const [memberUsage, setMemberUsage] = useState<MemberUsage[]>([])
  const [loadingUsage, setLoadingUsage] = useState(true)

  useEffect(() => {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    fetch(`/api/admin/reports/member-usage?month=${month}`)
      .then(r => r.json())
      .then(data => setMemberUsage(data))
      .catch(() => toast.error('Failed to load member usage'))
      .finally(() => setLoadingUsage(false))
  }, [])

  function toggleExpand(companyId: string) {
    setExpandedCompanies(prev => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  function getMembersForCompany(companyId: string) {
    return memberUsage.filter(m => m.company_id === companyId)
  }

  async function refreshCompanies() {
    const r = await fetch('/api/admin/companies')
    setCompanies(await r.json())
  }

  async function refreshTypes() {
    const r = await fetch('/api/admin/membership-types')
    setMembershipTypes(await r.json())
  }

  // ── Companies ─────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch('/api/admin/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        monthly_hours_allotment: parseFloat(newHours),
      }),
    })
    if (res.ok) {
      toast.success('Company created')
      setNewName(''); setNewHours('0'); setShowForm(false)
      await refreshCompanies()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to create company')
    }
    setCreating(false)
  }

  // ── Membership types (individual-member hours quick-fill only — no
  // longer linked to companies) ───────────────────────────────────────────────

  async function handleCreateType(e: React.FormEvent) {
    e.preventDefault()
    setCreatingType(true)
    const res = await fetch('/api/admin/membership-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newTypeName,
        hours_per_month: newTypeHours === '' ? null : parseFloat(newTypeHours),
      }),
    })
    if (res.ok) {
      toast.success('Type created')
      setNewTypeName(''); setNewTypeHours('')
      await refreshTypes()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setCreatingType(false)
  }

  async function handleSaveType() {
    if (!editingType) return
    setSavingType(true)
    const res = await fetch(`/api/admin/membership-types/${editingType.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingType.name,
        hours_per_month: editingType.hours === '' ? null : parseFloat(editingType.hours),
      }),
    })
    if (res.ok) {
      toast.success('Updated')
      setEditingType(null)
      await refreshTypes()
      await refreshCompanies()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSavingType(false)
  }

  async function handleDeleteType(id: string) {
    setDeletingType(id)
    const res = await fetch(`/api/admin/membership-types/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Type deleted')
      await refreshTypes()
      await refreshCompanies()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setDeletingType(null)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('')
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationFilter, setLocationFilter] = useState('')

  useEffect(() => {
    fetch('/api/locations').then(r => r.json()).then(setLocations)
  }, [])

  // TEMPORARY — remove once the GetARoom hours reconciliation is done. Lets
  // Caroline isolate the "0 hours" group to see collectively who still
  // needs a real number.
  const [hoursFilter, setHoursFilter] = useState<'all' | 'zero' | 'nonzero'>('all')
  const zeroCount    = companies.filter(c => !c.monthly_hours_allotment).length
  const nonzeroCount = companies.length - zeroCount

  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [showAll, setShowAll]   = useState(false)

  const companiesWithLocation = locationFilter
    ? new Set(memberUsage.filter(m => m.default_location_id === locationFilter).map(m => m.company_id))
    : null

  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase()
    if (q && !c.name.toLowerCase().includes(q)) return false
    if (companiesWithLocation && !companiesWithLocation.has(c.id)) return false
    if (hoursFilter === 'zero' && c.monthly_hours_allotment) return false
    if (hoursFilter === 'nonzero' && !c.monthly_hours_allotment) return false
    return true
  })

  useEffect(() => { setPage(1) }, [searchQuery, locationFilter, hoursFilter])

  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / pageSize))
  const pagedCompanies = showAll ? filteredCompanies : filteredCompanies.slice((page - 1) * pageSize, page * pageSize)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{companies.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowManageTypes(v => !v)}
            className="flex items-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-3 py-2 rounded-lg transition-colors">
            <Settings size={14} /> Manage Types
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus size={16} /> Add Company
          </button>
        </div>
      </div>

      {/* Manage Types panel — animated reveal instead of an abrupt mount */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showManageTypes ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Membership Types</h3>
              <p className="text-xs text-gray-400 mt-0.5">Just labels for reporting/filtering — a company's actual hours are always set manually below, never derived from its type.</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 pb-2">Hrs / mo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {membershipTypes.map(t => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4">
                      {editingType?.id === t.id ? (
                        <input value={editingType.name}
                          onChange={e => setEditingType(v => v ? { ...v, name: e.target.value } : v)}
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs" />
                      ) : (
                        <span className="font-medium text-gray-900">{t.name}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {editingType?.id === t.id ? (
                        <input type="number" min="0" step="0.5"
                          value={editingType.hours}
                          onChange={e => setEditingType(v => v ? { ...v, hours: e.target.value } : v)}
                          placeholder="varies"
                          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24" />
                      ) : (
                        <span className="text-gray-600">{t.hours_per_month != null ? `${t.hours_per_month}h` : <span className="text-gray-400 italic">varies</span>}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {editingType?.id === t.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={handleSaveType} disabled={savingType}
                            className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1 rounded font-medium">
                            <Check size={11} /> {savingType ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingType(null)} className="text-xs text-gray-400 hover:text-gray-600">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingType({ id: t.id, name: t.name, hours: t.hours_per_month != null ? String(t.hours_per_month) : '' })}
                            className="p-1 text-gray-400 hover:text-gray-600"><Edit2 size={13} /></button>
                          <button onClick={() => handleDeleteType(t.id)} disabled={deletingType === t.id}
                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add new type */}
            <form onSubmit={handleCreateType} className="flex items-end gap-2 pt-1 border-t border-gray-100">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">New Type Name</label>
                <input required value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Premium" />
              </div>
              <div className="w-28">
                <label className="block text-xs font-medium text-gray-600 mb-1">Hrs / mo</label>
                <input type="number" min="0" step="0.5" value={newTypeHours} onChange={e => setNewTypeHours(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="varies" />
              </div>
              <button type="submit" disabled={creatingType}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
                <Plus size={13} /> {creatingType ? '…' : 'Add'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Add company form — animated reveal instead of an abrupt mount */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${showForm ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">New Company</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
                <input required value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Hours</label>
                <input type="number" min="0" step="0.5" required value={newHours} onChange={e => setNewHours(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="enter hours" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={creating}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {creating ? 'Creating…' : 'Create Company'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      {/* Search + Location filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Search companies..." />
        </div>
        {locations.length > 0 && (
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700">
            <option value="">All Locations</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      {/* TEMPORARY — remove once the GetARoom hours reconciliation is done */}
      <div className="flex items-center gap-1.5">
        {([
          ['all', `All (${companies.length})`],
          ['nonzero', `Has Hours (${nonzeroCount})`],
          ['zero', `0 Hours (${zeroCount})`],
        ] as const).map(([value, label]) => (
          <button key={value} onClick={() => setHoursFilter(value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              hoursFilter === value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Companies table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-blue-600">Companies ({filteredCompanies.length})</h2>
          <div className="flex items-center gap-3 text-xs flex-shrink-0">
            <button onClick={() => setShowAll(v => !v)} className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">
              {showAll ? `Show ${pageSize} per page` : 'Show all'}
            </button>
            {!showAll && (
              <label className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                Per page:
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="border border-gray-300 rounded px-1.5 py-0.5 text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            {!showAll && totalPages > 1 && (
              <div className="flex items-center gap-1 text-gray-500 whitespace-nowrap">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1 hover:text-gray-800 disabled:opacity-30 rounded">
                  <ChevronLeft size={14} />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1 hover:text-gray-800 disabled:opacity-30 rounded">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        <AdminTable colWidths={['6%', '45%', '25%', '24%']} minWidth={900}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-2 py-3" />
              <Th>Company</Th>
              <Th>Monthly Hours</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filteredCompanies.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">{searchQuery ? 'No companies match your search.' : 'No companies yet.'}</td></tr>
            )}
            {pagedCompanies.map(c => {
              const isExpanded = expandedCompanies.has(c.id)
              const members = getMembersForCompany(c.id)
              return (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-2 py-3 text-center">
                      <button onClick={() => toggleExpand(c.id)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    <td className={tdTruncate} title={c.name}>
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </td>
                    <td className={tdNowrap}>
                      <span className="text-gray-700">{c.monthly_hours_allotment}h</span>
                    </td>
                    <td className={tdBase}>
                      <button
                        onClick={() => setEditTarget({ id: c.id, name: c.name, monthly_hours_allotment: c.monthly_hours_allotment })}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                        <Edit2 size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                  {/* Always mounted — an inner grid-rows transition animates the
                      expand/collapse instead of the row hard-mounting/unmounting. */}
                  <tr className="bg-gray-50/70">
                    <td colSpan={4} className="p-0">
                      <div className={`grid transition-[grid-template-rows] duration-250 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                          <div className="px-4 py-3">
                            {loadingUsage ? (
                              <p className="text-xs text-gray-400 py-2">Loading members...</p>
                            ) : members.length === 0 ? (
                              <p className="text-xs text-gray-400 py-2">No members in this company.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left font-semibold text-gray-500 pb-1.5 pl-6">Name</th>
                                    <th className="text-left font-semibold text-gray-500 pb-1.5">Email</th>
                                    <th className="text-left font-semibold text-gray-500 pb-1.5">Hours Used</th>
                                    <th className="text-left font-semibold text-gray-500 pb-1.5">Bookings</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {members.map((m, i) => (
                                    <tr key={m.email + i} className="border-b border-gray-100 last:border-0">
                                      <td className="py-1.5 pl-6 text-gray-700">
                                        {m.full_name ?? <span className="text-gray-400 italic">Not registered</span>}
                                      </td>
                                      <td className="py-1.5 text-gray-600">{m.email}</td>
                                      <td className="py-1.5 text-gray-700 font-medium">{m.hours_used}h</td>
                                      <td className="py-1.5 text-gray-700">{m.reservation_count}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              )
            })}
          </tbody>
        </AdminTable>
      </div>

      <EditCompanyDialog
        company={editTarget}
        onOpenChange={v => { if (!v) setEditTarget(null) }}
        onSuccess={refreshCompanies}
      />
    </div>
  )
}
