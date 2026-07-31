import { redirect } from 'next/navigation'
import { getAuthedProfile } from '@/lib/supabase/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthedProfile()
  if (!profile?.is_admin) redirect('/dashboard')

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        {children}
      </div>
    </div>
  )
}
