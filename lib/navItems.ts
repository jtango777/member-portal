import { LayoutDashboard, DoorOpen, Smile, CalendarClock, Users, Building2, Megaphone, BarChart2, BookOpen, Clock, Activity, MessageSquare, CreditCard, UserCircle } from 'lucide-react'

export type NavItem = { href: string; label: string; icon: React.ElementType; indent?: boolean }

export const memberNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/rooms', label: 'Rooms', icon: DoorOpen },
  // Indented — it's really a sub-view of Rooms (your own bookings), not a
  // separate top-level section.
  { href: '/dashboard/my-reservations', label: 'My Reservations', icon: CalendarClock, indent: true },
  { href: '/dashboard/faces', label: 'Faces', icon: Smile },
]

export const adminNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/rooms', label: 'Rooms', icon: DoorOpen },
  { href: '/dashboard/faces', label: 'Faces', icon: Smile },
]

export type NavGroup = { label: string | null; items: NavItem[] }

export const adminManageGroups: NavGroup[] = [
  {
    label: 'People',
    items: [
      { href: '/dashboard/admin/members', label: 'Members', icon: Users },
      { href: '/dashboard/admin/companies', label: 'Companies', icon: Building2 },
    ],
  },
  {
    label: 'Comms',
    items: [
      { href: '/dashboard/admin/announcements', label: 'Announcements', icon: Megaphone },
      { href: '/dashboard/admin/feedback', label: 'Feedback', icon: MessageSquare },
    ],
  },
  {
    label: 'Rooms & Bookings',
    items: [
      // One entry per product, each holding its own bookings and settings.
      // "All Bookings" was a separate entry that sounded like it included
      // day passes and never did (Caroline, 2026-09-25).
      { href: '/dashboard/admin/rooms', label: 'Conference Rooms', icon: DoorOpen },
      { href: '/dashboard/admin/day-passes', label: 'Day Passes', icon: CreditCard },
      { href: '/dashboard/admin/booking-accounts', label: 'Booking Customers', icon: UserCircle },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/dashboard/admin/reports', label: 'Reports', icon: BarChart2 },
      { href: '/dashboard/admin/time-usage', label: 'Time Usage', icon: Clock },
      { href: '/dashboard/admin/page-visits', label: 'Page Activity', icon: Activity },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { href: '/dashboard/admin/quickbooks', label: 'QuickBooks', icon: BookOpen },
    ],
  },
]

export const adminManageNavItems: NavItem[] = adminManageGroups.flatMap(g => g.items)
