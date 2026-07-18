'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/', label: 'Make Picks' },
  { href: '/my-picks', label: 'My Picks' },
  { href: '/all-picks', label: 'All Picks' },
  { href: '/standings', label: 'Standings' },
  { href: '/survivor', label: 'Survivor' },
]

export function Nav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const tabs = isAdmin ? [...TABS, { href: '/admin', label: 'Admin' }] : TABS

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b-2 border-line sm:gap-4">
      {tabs.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`ff-display relative shrink-0 whitespace-nowrap px-4 py-2.5 text-lg transition-colors sm:text-xl ${
              active ? 'text-primary' : 'text-muted hover:text-ink'
            }`}
          >
            {tab.label}
            {active && <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-primary" />}
          </Link>
        )
      })}
    </nav>
  )
}
