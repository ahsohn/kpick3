import Link from 'next/link'
import type { User } from '@/lib/db/schema'
import { getSurvivorBannerStatus } from '@/lib/survivor/queries'
import { Header } from './Header'

/**
 * Page chrome: the 64px Prime Time header (with pool switcher + contextual tabs) and
 * footer. Pages supply their own content containers. The amber alert dot on the
 * SURVIVOR segment lights up whenever the survivor banner status has something to say.
 */
export async function Shell({
  user,
  week,
  children,
}: {
  user: User
  week: number | null
  children: React.ReactNode
}) {
  const survivorStatus = await getSurvivorBannerStatus(user.id)

  return (
    <>
      <Header
        displayName={user.displayName}
        isAdmin={user.isAdmin}
        week={week}
        survivorAlert={survivorStatus !== null}
      />
      {children}
      <footer className="pb-8 pt-4 text-center text-xs text-muted">
        <Link href="/" className="hover:text-ink">kpick3.com</Link> · lines &amp; scores via ESPN
      </footer>
    </>
  )
}
