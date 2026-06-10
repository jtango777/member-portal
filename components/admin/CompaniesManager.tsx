'use client'

import { useState } from 'react'
import { Company, MembershipType } from '@/types'
import { Plus, Edit2, Check, X, Settings, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = {
  companies:       Company[]
  membershipTypes: MembershipType[]
}

type EditState = { id: string; name: string; hours: string } | null
type TypeEditState = { id: string; name: string; hours: string } | null

export default function CompaniesManager({ companies: initial, membershipTypes: initialTypes }: Props) {
  const [companies,       setCompanies]       = useState(initial)
  const [membershipTypes, setMembershipTypes] = useState(initialTypes)
  const [showForm,        setShowForm]        = useState(false)
  const [showManageTypes, setShowManageTypes] = useState(false)
  const [newName,             setNewName]             = useState('')
  const [newHours,            setNewHours]            = useState('0')
  const [newMembershipTypeId, setNewMembershipTypeId] = useState('')
  const [creating,            setCreating]            = useState(false)
  const [editing,             setEditing]             = useState<EditState>(null)
  const [saving,              setSaving]              = useState(false)
  const [assigningType,       setAssigningType]       = useState<string | null>(null)
  // Manage types state
  const [newTypeName,     setNewTypeName]     = useState('')
  const [newTypeHours,    setNewTypeHours]    = useState('')
  const [creatingType,    setCreatingType]    = useState(false)
  const [editingType,     setEditingType]     = useState<TypeEditState>(null)
  const [savingType,      setSavingType]      = useState(false)
  const [deletingType,    setDeletingType]    = useState<string | null>(null)

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
        membership_type_id: newMembershipTypeId || null,
      }),
    })
    if (res.ok) {
      toast.success('Company created')
      setNewName(''); setNewHours('0'); setNewMembershipTypeId(''); setShowForm(false)
      await refreshCompanies()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to create company')
    }
    setCreating(false)
  }

  function handleNewTypeSelect(typeId: string) {
    setNewMembershipTypeId(typeId)
    if (typeId) {
      const type = membershipTypes.find(t => t.id === typeId)
      setNewHours(type?.hours_per_month != null ? String(type.hours_per_month) : '')
    }
  }

  async function handleSaveEdit() {
    if (!editing) return
    setSaving(true)
    const res = await fetch(`/api/admin/companies/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editing.name, monthly_hours_allotment: parseFloat(editing.hours) }),
    })
    if (res.ok) {
      toast.success('Updated')
      setEditing(null)
      await refreshCompanies()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSaving(false)
  }

  async function handleTypeChange(companyId: string, typeId: string | null) {
    setAssigningType(companyId)
    const res = await fetch(`/api/admin/companies/${companyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membership_type_id: typeId }),
    })
    if (res.ok) {
      await refreshCompanies()
    } else {
      toast.error('Failed to update membership type')
    }
    setAssigningType(null)
  }

  async function handleAutoAssign() {
    setAutoAssigning(true)
    const res  = await fetch('/api/admin/membership-types/auto-assign', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      toast.success(`${data.assigned} assigned · ${data.skipped} need review`)
      await refreshCompanies()
    } else {
      toast.error(data.error ?? 'Auto-assign failed')
    }
    setAutoAssigning(false)
  }

  // ── Membership types ───────────────────────────────────────────────────────

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

  const reviewCount = companies.filter(c => !c.membership_type_id).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {companies.length} total
            {reviewCount > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {reviewCount} need type review</span>
            )}
          </p>
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

      {/* Manage Types panel */}
      {showManageTypes && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Membership Types</h3>
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
      )}

      {/* Add company form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">New Company</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
              <input required value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corp" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Membership Type</label>
              <select value={newMembershipTypeId} onChange={e => handleNewTypeSelect(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">— select type —</option>
                {membershipTypes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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
      )}

      {/* Companies table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Company</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Monthly Hours</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Membership Type</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No companies yet.</td></tr>
            )}
            {companies.map(c => (
              <tr key={c.id} className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${!c.membership_type_id ? 'bg-amber-50/40' : ''}`}>
                <td className="px-4 py-3">
                  {editing?.id === c.id ? (
                    <input value={editing.name} onChange={e => setEditing(v => v ? { ...v, name: e.target.value } : v)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full max-w-xs" />
                  ) : (
                    <span className="font-medium text-gray-900">{c.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editing?.id === c.id ? (
                    <input type="number" min="0" step="0.5" value={editing.hours}
                      onChange={e => setEditing(v => v ? { ...v, hours: e.target.value } : v)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24" />
                  ) : (
                    <span className="text-gray-700">{c.monthly_hours_allotment}h</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={c.membership_type_id ?? ''}
                    onChange={e => handleTypeChange(c.id, e.target.value || null)}
                    disabled={assigningType === c.id}
                    className={`text-xs rounded-full px-2.5 py-1 border font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                      c.membership_type_id
                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}
                  >
                    <option value="">⚠ Review</option>
                    {membershipTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {editing?.id === c.id ? (
                    <div className="flex items-center gap-2">
                      <button onClick={handleSaveEdit} disabled={saving}
                        className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-md font-medium">
                        <Check size={12} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditing(null)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditing({ id: c.id, name: c.name, hours: String(c.monthly_hours_allotment) })}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                      <Edit2 size={12} /> Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
