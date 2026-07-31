import { createClient } from '@/lib/supabase/server'
import { getAuthedUser, getAuthedProfile } from '@/lib/supabase/session'
import { redirect } from 'next/navigation'
import SettingsForm from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await getAuthedUser()
  if (!user) redirect('/login')
  const supabase = await createClient()

  const [profile, { data: locations }] = await Promise.all([
    getAuthedProfile(),
    supabase.from('locations').select('*').order('name'),
  ])

  if (!profile) redirect('/login')

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Settings</h1>
        <p className="text-sm text-gray-500 mb-6">Update your profile and preferences.</p>
        <SettingsForm
          profile={profile}
          company={(profile.companies as any) ?? null}
          locations={locations ?? []}
          email={user.email ?? ''}
        />
      </div>
    </div>
  )
}
