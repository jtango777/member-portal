'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { LogOut, CalendarDays, Users, Building2, Clock, ChevronDown, LayoutDashboard, DoorOpen, BarChart2, Globe, Settings } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

type Props = { profile: Profile }

export default function Nav({ profile }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const adminLinks = [
    { href: '/dashboard/admin',              label: 'Dashboard',        icon: LayoutDashboard },
    { href: '/dashboard/admin/reservations', label: 'All Reservations', icon: CalendarDays },
    { href: '/dashboard/admin/members',      label: 'Members',          icon: Users },
    { href: '/dashboard/admin/companies',    label: 'Companies',        icon: Building2 },
    { href: '/dashboard/admin/rooms',        label: 'Rooms',            icon: DoorOpen },
    { href: '/dashboard/admin/time-usage',   label: 'Time Usage',       icon: Clock },
    { href: '/dashboard/admin/reports',            label: 'Reports',           icon: BarChart2 },
    { href: '/dashboard/admin/external-bookings', label: 'External Bookings', icon: Globe },
  ]

  return (
    <nav className="bg-slate-900 text-white px-4 h-14 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-6">
        <Link href={pathname.startsWith('/dashboard/admin') ? '/dashboard/admin' : '/dashboard'} className="flex items-center gap-2 hover:opacity-90">
          <span className="text-xl font-bold tracking-tight text-white">BizHaus</span>
          {pathname.startsWith('/dashboard/admin') ? (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded">Admin Hub</span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600">Member</span>
          )}
        </Link>
        <Link href="/dashboard"
          className={cn('text-sm font-medium transition-colors',
            pathname === '/dashboard' ? 'text-white' : 'text-slate-400 hover:text-white')}>
          Calendar
        </Link>
        <Link href="/dashboard/my-reservations"
          className={cn('text-sm font-medium transition-colors',
            pathname === '/dashboard/my-reservations' ? 'text-white' : 'text-slate-400 hover:text-white')}>
          My Reservations
        </Link>
        {profile.is_admin && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className={cn(
              'flex items-center gap-1 text-sm font-medium transition-colors outline-none',
              pathname.startsWith('/dashboard/admin') ? 'text-white' : 'text-slate-400 hover:text-white'
            )}>
              Admin <ChevronDown size={14} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px] z-50"
                sideOffset={8}
              >
                {adminLinks.map(link => (
                  <DropdownMenu.Item key={link.href} asChild>
                    <Link
                      href={link.href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer outline-none',
                        pathname === link.href ? 'font-semibold text-blue-600' : 'text-gray-700'
                      )}
                    >
                      <link.icon size={15} className="text-gray-500" />
                      {link.label}
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300 hidden sm:block">
          {profile.full_name}
        </span>
        <div className="relative group">
          <Link href="/dashboard/settings"
            className={cn('text-slate-400 hover:text-white transition-colors flex', pathname === '/dashboard/settings' ? 'text-white' : '')}>
            <Settings size={16} />
          </Link>
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-1 text-xs bg-gray-900 text-white rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
            Settings
          </span>
        </div>
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
