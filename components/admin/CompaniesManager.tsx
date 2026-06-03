'use client'

import { useState } from 'react'
import { Company } from '@/types'
import { Plus, Edit2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = { companies: Company[] }

type EditState = { id: string; name: string; hours: string } | null

export default function CompaniesManager({ companies: initial }: Props) {
  const [companies, setCompanies] = useState(initial)
  const [showForm, setShowForm]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newHours, setNewHours]   = useState('0')
  const [creating, setCreating]   = useState(false)
  const [editing, setEditing]     = useState<EditState>(null)
  const [saving, setSaving]       = useState(false)

  async function refreshCompanies() {
    const r = await fetch('/api/admin/companies')
    setCompanies(await r.json())
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    const res = await fetch('/api/admin/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, monthly_hours_allotment: parseFloat(newHours) }),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Companies</h1>
          <p className="text-sm text-gray-500 mt-0.5">{companies.length} total</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add Company
        </button>
      </div>

      {showForm && (
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
              <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Hours Allotment</label>
              <input type="number" min="0" step="0.5" required value={newHours} onChange={e => setNewHours(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="40" />
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Company</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Monthly Hours</th>
              <th className="text-left font-semibold text-gray-600 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No companies yet.</td></tr>
            )}
            {companies.map(c => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
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
