'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Users, DoorOpen, BookOpen, LayoutDashboard, BarChart2, Clock, ChevronDown } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

const ROOMS_ADMIN_PATHS = [
  '/dashboard/rooms',
  '/dashboard/admin',
  '/dashboard/admin/rooms',
  '/dashboard/admin/reservations',
  '/dashboard/admin/quickbooks',
  '/dashboard/admin/reports',
  '/dashboard/admin/time-usage',
]

const manageLinks = [
  { href: '/dashboard/admin/rooms',        label: 'Rooms',        icon: DoorOpen },
  { href: '/dashboard/admin/reservations', label: 'All Bookings', icon: CalendarDays },
  { href: '/dashboard/admin/quickbooks',   label: 'QuickBooks',   icon: BookOpen },
]

const reportLinks = [
  { href: '/dashboard/admin',            label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/dashboard/admin/reports',    label: 'Reports',    icon: BarChart2 },
  { href: '/dashboard/admin/time-usage', label: 'Time Usage', icon: Clock },
]

function SubDropdown({ label, links, pathname }: { label: string; links: { href: string; label: string; icon: React.ElementType }[]; pathname: string }) {
  const isActive = links.some(l => pathname === l.href)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={cn(
        'flex items-center gap-1 text-sm font-medium transition-colors outline-none',
        isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
      )}>
        {label} <ChevronDown size={14} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px] z-[70]"
          sideOffset={8}
        >
          {links.map(link => (
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
  )
}

export default function RoomsSubNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  if (!isAdmin || !ROOMS_ADMIN_PATHS.includes(pathname)) return null

  return (
    <div className="bg-white border-b border-gray-200 px-4 h-11 flex items-center gap-6 flex-shrink-0">
      <Link href="/dashboard/rooms"
        className={cn('text-sm font-medium transition-colors',
          pathname === '/dashboard/rooms' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900')}>
        Calendar
      </Link>
      <SubDropdown label="Manage" links={manageLinks} pathname={pathname} />
      <SubDropdown label="Reports" links={reportLinks} pathname={pathname} />
      <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
        <Users size={12} /> Rooms admin
      </span>
    </div>
  )
}
