'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { memberNavItems, adminNavItems, adminManageNavItems, type NavItem } from '@/lib/navItems'

export default function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const items: NavItem[] = [
    ...(isAdmin ? adminNavItems : memberNavItems),
    ...(isAdmin ? adminManageNavItems : []),
  ]

  return (
    <div className="sm:hidden flex overflow-x-auto gap-1 bg-white border-b border-gray-200 px-2 py-2 flex-shrink-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap flex-shrink-0 transition-colors',
              active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'
            )}>
            <Icon size={14} />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
