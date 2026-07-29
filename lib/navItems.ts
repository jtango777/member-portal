import { LayoutDashboard, DoorOpen, Smile, CalendarClock, Users, Building2, Megaphone, BarChart2, CalendarDays, BookOpen, Clock } from 'lucide-react'

export type NavItem = { href: string; label: string; icon: React.ElementType }

export const memberNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/rooms', label: 'Rooms', icon: DoorOpen },
  { href: '/dashboard/my-reservations', label: 'My Reservations', icon: CalendarClock },
  { href: '/dashboard/haus-smiles', label: 'Faces', icon: Smile },
]

export const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/rooms', label: 'Rooms', icon: DoorOpen },
  { href: '/dashboard/haus-smiles', label: 'Faces', icon: Smile },
]

export const adminManageNavItems: NavItem[] = [
  { href: '/dashboard/admin/members', label: 'Members', icon: Users },
  { href: '/dashboard/admin/companies', label: 'Companies', icon: Building2 },
  { href: '/dashboard/admin/rooms', label: 'Rooms Admin', icon: DoorOpen },
  { href: '/dashboard/admin/reservations', label: 'All Bookings', icon: CalendarDays },
  { href: '/dashboard/admin/quickbooks', label: 'QuickBooks', icon: BookOpen },
  { href: '/dashboard/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/dashboard/admin/reports', label: 'Reports', icon: BarChart2 },
  { href: '/dashboard/admin/time-usage', label: 'Time Usage', icon: Clock },
  { href: '/dashboard/admin/page-visits', label: 'Page Activity', icon: BarChart2 },
]
