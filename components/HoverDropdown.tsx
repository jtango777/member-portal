'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

type LinkItem = { href: string; label: string; icon?: React.ElementType }

type Props = {
  label: string
  links: LinkItem[]
  pathname: string
  triggerClassName: string
  contentClassName?: string
}

export default function HoverDropdown({ label, links, pathname, triggerClassName, contentClassName }: Props) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function openNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }
  function closeSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <div onMouseEnter={openNow} onMouseLeave={closeSoon}>
        <DropdownMenu.Trigger className={triggerClassName}>
          {label}
          <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            onMouseEnter={openNow}
            onMouseLeave={closeSoon}
            className={cn('bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] z-[70]', contentClassName)}
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
                  {link.icon && <link.icon size={15} className="text-gray-500" />}
                  {link.label}
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </div>
    </DropdownMenu.Root>
  )
}
