'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Users, DoorOpen, BookOpen, LayoutDashboard, BarChart2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import HoverDropdown from './HoverDropdown'

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
    <HoverDropdown
      label={label}
      links={links}
      pathname={pathname}
      triggerClassName={cn(
        'flex items-center gap-1 text-sm font-medium transition-colors outline-none',
        isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
      )}
      contentClassName="min-w-[200px]"
    />
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
