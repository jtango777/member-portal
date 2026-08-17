'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'

export type EditableCompany = {
  id: string
  name: string
  monthly_hours_allotment: number
  location_id: string | null
  grants_admin: boolean
}

type Props = {
  company: EditableCompany | null
  locations: { id: string; name: string }[]
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Same modal pattern as EditMemberDialog — a real dialog instead of inline
// row editing, which kept fighting layout shift the same way it did on
// Members before that moved to a modal too.
export default function EditCompanyDialog({ company, locations, onOpenChange, onSuccess }: Props) {
  const [name, setName]   = useState('')
  const [hours, setHours] = useState('')
  const [locationId, setLocationId] = useState('')
  const [grantsAdmin, setGrantsAdmin] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!company) return
    setName(company.name)
    setHours(String(company.monthly_hours_allotment))
    setLocationId(company.location_id ?? '')
    setGrantsAdmin(company.grants_admin)
  }, [company])

  async function handleSave() {
    if (!company) return
    setSaving(true)
    const res = await fetch(`/api/admin/companies/${company.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:                     name.trim(),
        monthly_hours_allotment:  hours !== '' ? Number(hours) : 0,
        location_id:              locationId || null,
        grants_admin:             grantsAdmin,
      }),
    })
    if (res.ok) {
      toast.success('Company updated')
      onOpenChange(false)
      onSuccess()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSaving(false)
  }

  return (
    <Dialog.Root open={!!company} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md space-y-4 transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold text-gray-900">Edit Company</Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
              <select value={locationId} onChange={e => setLocationId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Not set — infer from members</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Which BizHaus this company is under. Leave unset to fall back to wherever its members are based.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Hours</label>
              <input type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Shared pool for everyone at this company — set this to whatever the office actually holds or was granted, not a formula.</p>
            </div>

            <label className="flex items-start gap-2 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={grantsAdmin} onChange={e => setGrantsAdmin(e.target.checked)}
                className="mt-0.5" />
              <span className="text-xs text-amber-900">
                <span className="font-medium">Grant admin automatically</span>
                <span className="block text-amber-700 mt-0.5">Anyone who registers under this company gets full admin access the moment they sign up. Doesn't affect people already registered.</span>
              </span>
            </label>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <Dialog.Close asChild>
                <button className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
