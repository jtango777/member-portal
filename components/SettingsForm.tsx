'use client'

import { useState } from 'react'
import { Profile, Location, Company } from '@/types'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import PhotoUploadDialog from '@/components/PhotoUploadDialog'
import PasswordInput from '@/components/PasswordInput'
import { SEATING_OPTIONS } from '@/lib/seating'

type Props = {
  profile:   Profile
  company:   Company | null
  locations: Location[]
  email:     string
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

export default function SettingsForm({ profile, company, locations, email }: Props) {
  const router = useRouter()
  const [fullName, setFullName]           = useState(profile.full_name)
  const [companyName, setCompanyName]     = useState(company?.name ?? '')
  const [locationId, setLocationId]       = useState((profile as any).default_location_id ?? '')
  const [licensePlate, setLicensePlate]   = useState(profile.license_plate ?? '')
  const [seating, setSeating]             = useState(profile.seating ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false)

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
        license_plate:       licensePlate,
        seating:             seating || null,
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
      {/* Photo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Photo</h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gray-100">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-500 text-lg font-semibold">{initials(profile.full_name)}</span>
            )}
          </div>
          <button onClick={() => setPhotoDialogOpen(true)}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            Change Photo
          </button>
        </div>
        <PhotoUploadDialog
          open={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          onSuccess={() => router.refresh()}
          title="Update your photo"
          description="This appears on Faces."
          currentImageUrl={profile.avatar_url}
        />
      </div>

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
            <p className="text-xs text-gray-400 mt-1">This is your default location in Rooms.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Where do you sit?</label>
            <select value={seating} onChange={e => setSeating(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Prefer not to say</option>
              {SEATING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Shown below your name on Faces.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
            <input value={licensePlate} onChange={e => setLicensePlate(e.target.value)}
              placeholder="ABC1234"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">For parking at your location.</p>
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
            <PasswordInput value={currentPw} onChange={setCurrentPw} required autoComplete="current-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <PasswordInput value={newPw} onChange={setNewPw} placeholder="At least 8 characters" required autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <PasswordInput value={confirmPw} onChange={setConfirmPw} required autoComplete="new-password" />
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
