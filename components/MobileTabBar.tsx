'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, DoorOpen, Smile, CalendarClock, Menu, X, LogOut, UserCog } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { adminManageGroups } from '@/lib/navItems'

const tabs = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/dashboard/rooms', label: 'Rooms', icon: DoorOpen },
  { href: '/dashboard/haus-smiles', label: 'Faces', icon: Smile },
  { href: '/dashboard/my-reservations', label: 'Bookings', icon: CalendarClock },
]

export default function MobileTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const moreActive = moreOpen || (!tabs.some(t => t.href === pathname) && pathname !== '/dashboard')

  return (
    <>
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMoreOpen(false)} />
      )}

      {moreOpen && (
        <div className="sm:hidden fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-2xl border-t border-gray-200 shadow-2xl max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">More</span>
            <button onClick={() => setMoreOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
          <div className="p-3 flex flex-col gap-1">
            <p className="px-3 pt-1 pb-1.5 text-xs font-bold tracking-wide text-blue-600 uppercase">Account</p>
            <Link href="/dashboard/settings" onClick={() => setMoreOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
              <UserCog size={17} /> Profile & settings
            </Link>
            <button onClick={signOut}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <LogOut size={17} /> Sign out
            </button>

            {isAdmin && (
              <>
                <p className="px-3 pt-4 pb-1.5 text-xs font-bold tracking-wide text-blue-600 uppercase">Admin</p>
                {adminManageGroups.map((group, i) => (
                  <div key={i} className={i > 0 ? 'mt-2' : undefined}>
                    {group.items.map(item => (
                      <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                        <item.icon size={17} /> {item.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <div className="sm:hidden flex-shrink-0 bg-white border-t border-gray-200 flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]',
                active ? 'text-blue-600' : 'text-gray-400'
              )}>
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
        <button onClick={() => setMoreOpen(v => !v)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]',
            moreActive ? 'text-blue-600' : 'text-gray-400'
          )}>
          <Menu size={20} />
          More
        </button>
      </div>
    </>
  )
}
