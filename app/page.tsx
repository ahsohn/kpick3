import { requireUser } from '@/lib/auth/session'
import { getGamesForWeek, getUserPicksForWeek } from '@/lib/picks/queries'
import { resolveWeek } from '@/lib/picks/page-data'
import { getSurvivorBannerStatus } from '@/lib/survivor/queries'
import { getLiveOverlays, withLive } from '@/lib/espn/live'
import { Shell } from '@/components/Shell'
import { WeekSelector } from '@/components/WeekSelector'
import { PickBoard } from '@/components/PickBoard'
import { SurvivorBanner } from '@/components/SurvivorBanner'
import { toBoardGame } from '@/components/board-types'

export const dynamic = 'force-dynamic'

export default async function MakePicksPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const user = await requireUser()
  const ctx = await resolveWeek((await searchParams).week)

  if (!ctx) {
    return (
      <Shell user={user} week={null}>
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          No games yet — the first ESPN sync hasn&rsquo;t run. Check back soon.
        </p>
      </Shell>
    )
  }

  const [games, myPicks, overlays, survivorStatus] = await Promise.all([
    getGamesForWeek(ctx.season, ctx.week),
    getUserPicksForWeek(user.id, ctx.season, ctx.week),
    getLiveOverlays(),
    getSurvivorBannerStatus(user.id),
  ])

  return (
    <Shell user={user} week={ctx.currentWeek}>
      <SurvivorBanner status={survivorStatus} />
      <WeekSelector weeks={ctx.weeks} current={ctx.week} basePath="/" />
      <PickBoard
        games={games.map((g) => toBoardGame(withLive(g, overlays)))}
        existingPicks={myPicks.map((p) => ({
          gameId: p.gameId,
          side: p.side as 'home' | 'away',
          lockedSpread: p.lockedSpread,
        }))}
      />
    </Shell>
  )
}
