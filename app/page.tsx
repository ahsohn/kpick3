import { requireUser } from '@/lib/auth/session'
import { getGamesForWeek, getUserPicksForWeek, getVisibleWeekPicks } from '@/lib/picks/queries'
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

  if (!user.pick3Enrolled) {
    return (
      <Shell user={user} week={ctx.currentWeek}>
        <div className="mx-auto max-w-[840px] px-7 py-6 max-lg:px-4">
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            You&rsquo;re not in the Pick 3 pool this season. Ask the commissioner if that&rsquo;s
            a mistake — Survivor and the other tabs still work as usual.
          </p>
        </div>
      </Shell>
    )
  }

  // Overlays first: that read also grades any newly-final game, so the picks
  // queried below already carry their results.
  const overlays = await getLiveOverlays()
  const [games, myPicks, { visible: revealedPicks }] = await Promise.all([
    getGamesForWeek(ctx.season, ctx.week),
    getUserPicksForWeek(user.id, ctx.season, ctx.week),
    getVisibleWeekPicks(ctx.season, ctx.week),
  ])

  return (
    <Shell user={user} week={ctx.currentWeek}>
      <WeekSelector
        weeks={ctx.weeks}
        current={ctx.week}
        basePath="/"
        helper="Lines lock 1 PM ET the day before each game · picks lock at kickoff"
      />
      <PickBoard
        games={games.map((g) => toBoardGame(withLive(g, overlays)))}
        existingPicks={myPicks.map((p) => ({
          gameId: p.gameId,
          side: p.side as 'home' | 'away',
          lockedSpread: p.lockedSpread,
          pickedSpread: p.pickedSpread,
        }))}
        pickers={revealedPicks.map((p) => ({
          gameId: p.gameId,
          side: p.side,
          displayName: p.displayName,
          result: p.result,
        }))}
      />
    </Shell>
  )
}
