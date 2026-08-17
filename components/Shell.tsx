import Link from 'next/link'
import type { User } from '@/lib/db/schema'
import { getSurvivorBannerStatus } from '@/lib/survivor/queries'
import { getLastSyncTime } from '@/lib/picks/queries'
import { formatAgo } from '@/lib/format'
import { Header } from './Header'

// One missed hourly cron run plus slack — past this the admin sees the stale banner.
const STALE_SYNC_MS = 75 * 60 * 1000

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
  const lastSync = user.isAdmin ? await getLastSyncTime() : null
  const syncStale = lastSync !== null && Date.now() - lastSync.getTime() > STALE_SYNC_MS

  return (
    <>
      <Header
        displayName={user.displayName}
        isAdmin={user.isAdmin}
        week={week}
        survivorAlert={survivorStatus !== null}
      />
      {syncStale && (
        <div className="border-b border-amber/40 bg-amber/10 px-4 py-2 text-center text-xs font-semibold text-amber">
          ⚠ Line sync last succeeded {formatAgo(lastSync)} ago — falling back to the most
          recent lines fetched. Check the cron job.
        </div>
      )}
      {children}
      <footer className="pb-8 pt-4 text-center text-xs text-muted">
        <Link href="/" className="hover:text-ink">kpick3.com</Link> · lines &amp; scores via ESPN
      </footer>
    </>
  )
}
