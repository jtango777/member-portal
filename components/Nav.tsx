'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = { profile: Profile }

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

function ProfileAvatar({ profile, active }: { profile: Profile; active: boolean }) {
  return (
    <Link href="/dashboard/settings" title="Profile & settings"
      className={cn('w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border transition-colors',
        active ? 'border-white' : 'border-slate-600 hover:border-slate-400')}>
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
      ) : (
        <span className="w-full h-full flex items-center justify-center bg-slate-700 text-white text-xs font-semibold">
          {initials(profile.full_name)}
        </span>
      )}
    </Link>
  )
}

export default function Nav({ profile }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (profile.is_admin) {
    return (
      <nav className="bg-slate-900 text-white px-4 h-16 flex items-center justify-between gap-4 flex-shrink-0 pointer-events-auto relative z-[60]">
        <Link href="/dashboard" className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/bizhaus-logo-white.png" alt="BizHaus" className="h-5 w-auto" />
          <span className="text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded">Member Portal</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm text-slate-200 leading-tight">{profile.full_name}</span>
            <button onClick={signOut}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors leading-tight"
              title="Sign out">
              <LogOut size={11} />
              Sign out
            </button>
          </div>
          <ProfileAvatar profile={profile} active={pathname === '/dashboard/settings'} />
          <button onClick={signOut} className="sm:hidden text-slate-400 hover:text-white transition-colors" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-slate-900 text-white px-4 h-16 flex items-center justify-between flex-shrink-0 pointer-events-auto relative z-[60]">
      <Link href="/dashboard" className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/bizhaus-logo-white.png" alt="BizHaus" className="h-5 w-auto" />
        <span className="text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded">Member Portal</span>
      </Link>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-sm text-slate-200 leading-tight">{profile.full_name}</span>
          <button onClick={signOut}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors leading-tight"
            title="Sign out">
            <LogOut size={11} />
            Sign out
          </button>
        </div>
        <ProfileAvatar profile={profile} active={pathname === '/dashboard/settings'} />
        <button onClick={signOut} className="sm:hidden text-slate-400 hover:text-white transition-colors" title="Sign out">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  )
}
