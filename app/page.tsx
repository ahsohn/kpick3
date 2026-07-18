import { requireUser } from '@/lib/auth/session'
import { getGamesForWeek, getUserPicksForWeek } from '@/lib/picks/queries'
import { resolveWeek } from '@/lib/picks/page-data'
import { getLiveOverlays, withLive } from '@/lib/espn/live'
import { Shell } from '@/components/Shell'
import { WeekSelector } from '@/components/WeekSelector'
import { PickBoard } from '@/components/PickBoard'
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
        <div className="mx-auto max-w-[840px] px-7 py-6 max-lg:px-4">
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            No games yet — the first ESPN sync hasn&rsquo;t run. Check back soon.
          </p>
        </div>
      </Shell>
    )
  }

  const [games, myPicks, overlays] = await Promise.all([
    getGamesForWeek(ctx.season, ctx.week),
    getUserPicksForWeek(user.id, ctx.season, ctx.week),
    getLiveOverlays(),
  ])

  return (
    <Shell user={user} week={ctx.currentWeek}>
      <WeekSelector
        weeks={ctx.weeks}
        current={ctx.week}
        basePath="/"
        helper="Spreads lock when you submit · picks lock at kickoff"
      />
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
