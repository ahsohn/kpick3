import Link from 'next/link'
import type { User } from '@/lib/db/schema'
import { logout } from '@/app/login/actions'
import { Nav } from './Nav'

/** Page chrome: red banner, logged-in strip, and the tab nav. */
export function Shell({
  user,
  week,
  children,
}: {
  user: User
  week: number | null
  children: React.ReactNode
}) {
  return (
    <>
      <header
        className="relative overflow-hidden px-6 py-8 text-center"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
          boxShadow: '0 4px 20px rgba(213,10,10,.3)',
        }}
      >
        <h1 className="ff-display text-5xl leading-none drop-shadow-[2px_2px_8px_rgba(0,0,0,.5)] sm:text-6xl">
          NFL Pick&rsquo;em Pool
        </h1>
        <div className="mt-1 text-sm font-medium tracking-[.2em] opacity-95">
          2026 SEASON{week ? ` · WEEK ${week}` : ''}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-sm">
            <span className="mr-2 uppercase tracking-wider text-muted">Logged in:</span>
            <strong className="text-base text-primary">{user.displayName}</strong>
            {user.isAdmin && (
              <span className="ml-2 rounded bg-secondary px-2 py-0.5 text-xs font-bold uppercase">Admin</span>
            )}
          </div>
          <form action={logout}>
            <button className="cursor-pointer rounded-lg border-2 border-line bg-surface-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider hover:border-primary">
              Logout
            </button>
          </form>
        </div>

        <Nav isAdmin={user.isAdmin} />
        {children}
      </div>

      <footer className="pb-8 text-center text-xs text-muted">
        <Link href="/" className="hover:text-ink">kpick3.com</Link> · lines &amp; scores via ESPN
      </footer>
    </>
  )
}
