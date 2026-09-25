import { redirect } from 'next/navigation'
import { getAuthedProfile } from '@/lib/supabase/session'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getAuthedProfile()
  if (!profile?.is_admin) redirect('/dashboard')

  return (
    <div className="h-full overflow-auto p-6">
      {/* The bottom padding lives on the inner wrapper, not the scrolling
          container: a scroll container's own padding-bottom is dropped once
          the content overflows, so every admin page ended flush against the
          window (Caroline, 2026-09-25). */}
      <div className="max-w-6xl mx-auto pb-10">
        {children}
      </div>
    </div>
  )
}
