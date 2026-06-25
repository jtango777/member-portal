'use client'

import { useState } from 'react'
import { Profile, Location, Company } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} required
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="button" onClick={() => setShow(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

type Props = {
  profile:   Profile
  company:   Company | null
  locations: Location[]
  email:     string
}

export default function SettingsForm({ profile, company, locations, email }: Props) {
  const router = useRouter()
  const [fullName, setFullName]           = useState(profile.full_name)
  const [companyName, setCompanyName]     = useState(company?.name ?? '')
  const [locationId, setLocationId]       = useState((profile as any).default_location_id ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw]   = useState(false)

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const res = await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:           fullName,
        default_location_id: locationId || null,
        company_name:        companyName,
      }),
    })
    if (res.ok) {
      toast.success('Settings saved')
      router.refresh()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to save')
    }
    setSavingProfile(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8)    { toast.error('Password must be at least 8 characters'); return }
    setSavingPw(true)

    // Verify current password first
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email:    user?.email ?? '',
      password: currentPw,
    })
    if (signInErr) {
      toast.error('Current password is incorrect')
      setSavingPw(false)
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setSavingPw(false)
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Profile settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {profile.is_admin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">Updates the name shown on your bookings.</p>
            </div>
          ) : company ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <p className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{company.name}</p>
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Location</label>
            <select value={locationId} onChange={e => setLocationId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">The calendar opens here when you log in.</p>
          </div>
          <button type="submit" disabled={savingProfile}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <PasswordInput value={currentPw} onChange={setCurrentPw} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <PasswordInput value={newPw} onChange={setNewPw} placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <PasswordInput value={confirmPw} onChange={setConfirmPw} />
          </div>
          <button type="submit" disabled={savingPw}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            {savingPw ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
