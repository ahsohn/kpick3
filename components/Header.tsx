'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

const PICK3_TABS = [
  { href: '/', label: 'Make Picks' },
  { href: '/my-picks', label: 'My Picks' },
  { href: '/all-picks', label: 'All Picks' },
  { href: '/standings', label: 'Standings' },
]

const SURVIVOR_TABS = [
  { href: '/survivor', label: 'Make Pick' },
  { href: '/survivor/board', label: 'The Board' },
]

/**
 * Prime Time header: wordmark + pool switcher + contextual tabs + week/avatar.
 * Survivor mode (amber) kicks in on /survivor*; everything else is Pick 3 (red).
 */
export function Header({
  displayName,
  isAdmin,
  week,
  survivorAlert,
}: {
  displayName: string
  isAdmin: boolean
  week: number | null
  survivorAlert: boolean
}) {
  const pathname = usePathname()
  const survivorMode = pathname.startsWith('/survivor')
  const tabs = survivorMode
    ? SURVIVOR_TABS
    : isAdmin
      ? [...PICK3_TABS, { href: '/admin', label: 'Admin' }]
      : PICK3_TABS
  const accent = survivorMode ? 'var(--color-amber)' : 'var(--color-accent)'
  const initial = (displayName[0] ?? '?').toUpperCase()

  const wordmark = (
    <Link href="/" className="text-[22px] font-extrabold italic tracking-[-.01em] max-lg:text-[19px]">
      KPICK<span className="text-accent">3</span>
    </Link>
  )

  const switcher = (
    <div className="flex gap-[3px] rounded-[10px] border border-control bg-surface-2 p-[3px] max-lg:mx-4">
      <Link
        href="/"
        className={`rounded-lg px-[18px] py-2 text-[13px] tracking-[.04em] max-lg:flex-1 max-lg:text-center ${
          survivorMode
            ? 'font-bold text-muted hover:text-ink'
            : 'bg-accent font-extrabold text-white'
        }`}
      >
        PICK 3
      </Link>
      <Link
        href="/survivor"
        className={`relative rounded-lg px-[18px] py-2 text-[13px] tracking-[.04em] max-lg:flex-1 max-lg:text-center ${
          survivorMode
            ? 'bg-amber font-extrabold text-amber-ink'
            : 'font-bold text-muted hover:text-ink'
        }`}
      >
        SURVIVOR
        {!survivorMode && survivorAlert && (
          <span className="absolute right-2 top-1.5 h-[7px] w-[7px] rounded-full bg-amber" />
        )}
      </Link>
    </div>
  )

  const weekAvatar = (
    <div className="flex items-center gap-2.5">
      {week !== null && (
        <span className="text-[11px] font-semibold tracking-[.14em] text-muted">WEEK {week}</span>
      )}
      <details className="group relative">
        <summary className="flex h-[30px] w-[30px] cursor-pointer list-none items-center justify-center rounded-full bg-accent text-xs font-extrabold [&::-webkit-details-marker]:hidden">
          {initial}
        </summary>
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-[10px] border border-control bg-surface-2 p-2 shadow-[0_8px_24px_rgba(0,0,0,.5)]">
          <div className="px-2 py-1.5 text-[13px] font-semibold text-ink-2">{displayName}</div>
          {isAdmin && (
            <div className="px-2 pb-1.5 text-[10px] font-extrabold tracking-[.1em] text-muted">ADMIN</div>
          )}
          <form action={logout}>
            <button className="w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold text-muted hover:bg-surface-3 hover:text-ink">
              Log out
            </button>
          </form>
        </div>
      </details>
    </div>
  )

  const navTabs = (underline = false) =>
    tabs.map((tab) => {
      const active = pathname === tab.href
      return (
        <Link
          key={tab.href}
          href={tab.href}
          className={`whitespace-nowrap text-[13px] ${
            underline ? 'py-[11px]' : 'rounded-[7px] px-3.5 py-[7px]'
          } ${active ? 'font-bold text-white' : 'font-semibold text-muted hover:text-ink'}`}
          style={active ? { boxShadow: `inset 0 -2px 0 ${accent}` } : undefined}
        >
          {tab.label}
        </Link>
      )
    })

  return (
    <header className="border-b border-control bg-header">
      {/* Desktop: single 64px bar */}
      <div className="hidden h-16 items-center justify-between gap-5 px-7 lg:flex">
        <div className="flex items-center gap-4">
          {wordmark}
          {switcher}
        </div>
        <nav className="flex gap-1">{navTabs()}</nav>
        {weekAvatar}
      </div>

      {/* Mobile: compressed rows */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between px-4 py-3.5">
          {wordmark}
          {weekAvatar}
        </div>
        {switcher}
        <nav className="mt-1 flex gap-[18px] overflow-x-auto border-t border-transparent px-4">
          {navTabs(true)}
        </nav>
      </div>
    </header>
  )
}
