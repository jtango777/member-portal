'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { memberNavItems, adminNavItems, adminManageGroups, type NavItem } from '@/lib/navItems'

const STORAGE_KEY = 'sidebar-collapsed'

export default function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === 'true')
    setMounted(true)
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  function NavLink({ href, label, icon: Icon }: NavItem) {
    const active = pathname === href
    return (
      <Link href={href} title={collapsed ? label : undefined}
        className={cn(
          'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
          collapsed && 'justify-center px-2',
          active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'
        )}>
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-600" />}
        <Icon size={17} className="flex-shrink-0" />
        {!collapsed && label}
      </Link>
    )
  }

  function SectionLabel({ children }: { children: React.ReactNode }) {
    if (collapsed) return null
    return <p className="px-3 pt-4 pb-1.5 text-xs font-bold tracking-wide text-blue-600 uppercase">{children}</p>
  }

  return (
    <div className={cn(
      'hidden sm:flex relative flex-shrink-0 bg-white border-r border-gray-200 flex-col transition-all duration-200',
      mounted ? (collapsed ? 'w-16' : 'w-52') : 'w-52'
    )}>
      <div className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
        {(isAdmin ? adminNavItems : memberNavItems).map(item => <NavLink key={item.href} {...item} />)}
        {isAdmin && (
          <>
            <div className="h-px bg-gray-200 mt-2 mx-1" />
            <SectionLabel>Admin</SectionLabel>
            {adminManageGroups.map((group, i) => (
              <div key={i} className={i > 0 ? 'mt-2' : undefined}>
                {group.items.map(item => <NavLink key={item.href} {...item} />)}
              </div>
            ))}
          </>
        )}
      </div>

      <button onClick={toggle} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-6 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-gray-200 shadow-sm text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors">
        {collapsed ? <ChevronRight size={13} strokeWidth={2.5} /> : <ChevronLeft size={13} strokeWidth={2.5} />}
      </button>
    </div>
  )
}
