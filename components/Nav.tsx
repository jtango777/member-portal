'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import HoverDropdown from './HoverDropdown'

type Props = { profile: Profile }

const manageLinks = [
  { href: '/dashboard/admin/members',       label: 'Members' },
  { href: '/dashboard/admin/companies',     label: 'Companies' },
  { href: '/dashboard/admin/announcements', label: 'Announcements' },
  { href: '/dashboard/admin/page-visits',   label: 'Page Activity' },
]

function ManageDropdown({ pathname }: { pathname: string }) {
  const isActive = manageLinks.some(l => pathname === l.href)
  return (
    <HoverDropdown
      label="Manage"
      links={manageLinks}
      pathname={pathname}
      triggerClassName={cn(
        'flex items-center gap-1 text-sm font-medium transition-colors outline-none',
        isActive ? 'text-white' : 'text-slate-400 hover:text-white'
      )}
    />
  )
}

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
      <nav className="bg-slate-900 text-white px-4 h-14 flex items-center justify-between gap-4 flex-shrink-0 pointer-events-auto relative z-[60]">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">BizHaus</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">Admin</span>
          </Link>

          <Link href="/dashboard/rooms"
            className={cn('text-sm font-medium transition-colors',
              pathname === '/dashboard/rooms' ? 'text-white' : 'text-slate-400 hover:text-white')}>
            Rooms
          </Link>
          <Link href="/dashboard/haus-smiles"
            className={cn('text-sm font-medium transition-colors',
              pathname === '/dashboard/haus-smiles' ? 'text-white' : 'text-slate-400 hover:text-white')}>
            Haus Smiles
          </Link>
          <ManageDropdown pathname={pathname} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300 hidden sm:block">
            {profile.full_name}
          </span>
          <ProfileAvatar profile={profile} active={pathname === '/dashboard/settings'} />
          <button onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            title="Sign out">
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </nav>
    )
  }

  return (
    <nav className="bg-slate-900 text-white px-4 h-14 flex items-center justify-between flex-shrink-0 pointer-events-auto relative z-[60]">
      <div className="flex items-baseline gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">BizHaus</span>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">Member Portal</span>
        </Link>
        <Link href="/dashboard/rooms"
          className={cn('text-sm font-medium transition-colors',
            pathname === '/dashboard/rooms' ? 'text-white' : 'text-slate-400 hover:text-white')}>
          Rooms
        </Link>
        <Link href="/dashboard/my-reservations"
          className={cn('text-sm font-medium transition-colors',
            pathname === '/dashboard/my-reservations' ? 'text-white' : 'text-slate-400 hover:text-white')}>
          My Reservations
        </Link>
        <Link href="/dashboard/haus-smiles"
          className={cn('text-sm font-medium transition-colors',
            pathname === '/dashboard/haus-smiles' ? 'text-white' : 'text-slate-400 hover:text-white')}>
          Haus Smiles
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300 hidden sm:block">
          {profile.full_name}
        </span>
        <ProfileAvatar profile={profile} active={pathname === '/dashboard/settings'} />
        <button onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          title="Sign out">
          <LogOut size={16} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </nav>
  )
}
