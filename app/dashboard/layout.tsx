import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Nav from '@/components/Nav'
import { Profile } from '@/types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/signout')

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Nav profile={profile as Profile} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
