import Link from 'next/link'
import { formatKickoff } from '@/lib/format'
import type { SurvivorBannerStatus } from '@/lib/survivor/queries'

/**
 * Homepage nag for an enrolled, still-alive player with no survivor pick this week.
 * Escalates as the week's games kick off; flips to the bad news once nothing pickable
 * remains. Renders nothing when there's nothing to say.
 */
export function SurvivorBanner({ status }: { status: SurvivorBannerStatus | null }) {
  if (!status) return null

  const styles = {
    normal: 'border-secondary bg-secondary/20',
    warning: 'border-warning/50 bg-warning/10 text-warning',
    missed: 'border-danger/50 bg-danger/10 text-danger',
  }[status.state]

  return (
    <Link
      href="/survivor"
      className={`mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 px-4 py-3 font-semibold transition-transform hover:-translate-y-0.5 ${styles}`}
    >
      <span>
        {status.state === 'normal' && (
          <>🏈 Survivor: no pick yet for Week {status.week} — pick a team to win.</>
        )}
        {status.state === 'warning' && (
          <>
            ⚠️ Survivor: Week {status.week} is kicking off — {status.remainingPickable} pickable game
            {status.remainingPickable === 1 ? '' : 's'} left
            {status.nextKickoffIso ? `, next at ${formatKickoff(new Date(status.nextKickoffIso))}` : ''}.
          </>
        )}
        {status.state === 'missed' && (
          <>💀 No survivor pick for Week {status.week} — that&rsquo;s your loss.</>
        )}
      </span>
      {status.state !== 'missed' && (
        <span className="ff-display shrink-0 rounded-lg bg-primary px-3 py-1 text-lg tracking-wider text-white">
          Make your pick →
        </span>
      )}
    </Link>
  )
}
