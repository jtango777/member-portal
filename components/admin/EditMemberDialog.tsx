'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Company, MembershipType } from '@/types'
import { SEATING_OPTIONS } from '@/lib/seating'
import CompanyCombobox from '@/components/admin/CompanyCombobox'

export type EditableMember = {
  id: string
  full_name: string | null
  email: string
  company_id: string | null
  individual_hours_allotment: number | null
  default_location_id: string | null
  seating: string | null
}

type Props = {
  member: EditableMember | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  companies: Company[]
  membershipTypes: MembershipType[]
  locations: { id: string; name: string }[]
}

// Presets are just a quick-fill shortcut now, not an enforced tier — real
// hours are a plain number (GetARoom numbers, bonus hours granted to a
// specific person, etc. don't fit a fixed preset). "Private Office" is a
// company-only concept, so it's left out of the shortcut list.
function individualMembershipTypes(types: MembershipType[]) {
  return types.filter(t => t.hours_per_month != null)
}

function pooledHoursLabel(companies: Company[], companyId: string) {
  const hours = companies.find(c => c.id === companyId)?.monthly_hours_allotment ?? 0
  return `${hours}h/month (pooled with company)`
}

// A real modal instead of trying to edit a table row in place — editing in
// place kept fighting us on layout shift (native <select> chrome, table
// column widths, row height quirks). A dialog sidesteps all of that: the
// table underneath never changes while it's open.
export default function EditMemberDialog({ member, onOpenChange, onSuccess, companies, membershipTypes, locations }: Props) {
  const [fullName, setFullName]     = useState('')
  const [email, setEmail]           = useState('')
  const [companyId, setCompanyId]   = useState('')
  const [individualHours, setIndividualHours] = useState('')
  const [locationId, setLocationId] = useState('')
  const [seating, setSeating]       = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (!member) return
    setFullName(member.full_name ?? '')
    setEmail(member.email)
    setCompanyId(member.company_id ?? '')
    setIndividualHours(member.individual_hours_allotment != null ? String(member.individual_hours_allotment) : '')
    setLocationId(member.default_location_id ?? '')
    setSeating(member.seating ?? '')
  }, [member])

  async function handleSave() {
    if (!member) return
    setSaving(true)
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:           fullName.trim() || null,
        email:               email.trim(),
        company_id:          companyId || null,
        individual_hours_allotment: individualHours !== '' ? Number(individualHours) : null,
        default_location_id: locationId || null,
        seating:             seating || null,
      }),
    })
    if (res.ok) {
      toast.success('Member updated')
      onOpenChange(false)
      onSuccess()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed')
    }
    setSaving(false)
  }

  return (
    <Dialog.Root open={!!member} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 transition-all duration-200 data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=closed]:opacity-0 data-[state=closed]:scale-95">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold text-gray-900">Edit Member</Dialog.Title>
              <Dialog.Close className="text-gray-400 hover:text-gray-600"><X size={16} /></Dialog.Close>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
              <CompanyCombobox
                companies={companies}
                value={companyId}
                onChange={id => { setCompanyId(id); if (id) setIndividualHours('') }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Room Hours</label>
              {companyId ? (
                <input type="text" disabled value={pooledHoursLabel(companies, companyId)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-500" />
              ) : (
                <>
                  <input type="number" min="0" step="0.5" value={individualHours}
                    onChange={e => setIndividualHours(e.target.value)}
                    placeholder="e.g. 6"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {individualMembershipTypes(membershipTypes).map(t => (
                      <button key={t.id} type="button" onClick={() => setIndividualHours(String(t.hours_per_month))}
                        className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-md">
                        {t.name} ({t.hours_per_month}h)
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {locations.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Default Location</label>
                <select value={locationId} onChange={e => setLocationId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No default location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Seating</label>
              <select value={seating} onChange={e => setSeating(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No seating set</option>
                {SEATING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

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
