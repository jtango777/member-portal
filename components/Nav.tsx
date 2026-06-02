'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { LogOut, CalendarDays, Users, Building2, Clock, ChevronDown } from 'lucide-react'
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
    { href: '/dashboard/admin/reservations', label: 'All Reservations', icon: CalendarDays },
    { href: '/dashboard/admin/members',      label: 'Members',          icon: Users },
    { href: '/dashboard/admin/companies',    label: 'Companies',        icon: Building2 },
    { href: '/dashboard/admin/time-usage',   label: 'Time Usage',       icon: Clock },
  ]

  return (
    <nav className="bg-slate-900 text-white px-4 h-14 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight hover:text-slate-200">
          BizHaus
        </Link>
        <Link
          href="/dashboard"
          className={cn(
            'text-sm font-medium transition-colors',
            pathname === '/dashboard' ? 'text-white' : 'text-slate-400 hover:text-white'
          )}
        >
          Calendar
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
                        pathname === link.href ? 'font-semibold text-blue-600' : ''
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
          {profile.is_admin && <span className="ml-2 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Admin</span>}
        </span>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </nav>
  )
}
