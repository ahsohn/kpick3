import { requireUser } from '@/lib/auth/session'
import { getGamesForWeek, getVisibleWeekPicks } from '@/lib/picks/queries'
import { resolveWeek } from '@/lib/picks/page-data'
import { getLiveOverlays, withLive } from '@/lib/espn/live'
import { Shell } from '@/components/Shell'
import { WeekSelector } from '@/components/WeekSelector'
import { ResultBadge } from '@/components/ResultBadge'
import { formatKickoff, formatSpread } from '@/lib/format'

export const dynamic = 'force-dynamic'

export default async function AllPicksPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const user = await requireUser()
  const ctx = await resolveWeek((await searchParams).week)

  if (!ctx) {
    return (
      <Shell user={user} week={null}>
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">No games yet.</p>
      </Shell>
    )
  }

  const [gamesRaw, { visible, hiddenCountByGame }, overlays] = await Promise.all([
    getGamesForWeek(ctx.season, ctx.week),
    getVisibleWeekPicks(ctx.season, ctx.week),
    getLiveOverlays(),
  ])
  const games = gamesRaw.map((g) => withLive(g, overlays))

  return (
    <Shell user={user} week={ctx.currentWeek}>
      <WeekSelector weeks={ctx.weeks} current={ctx.week} basePath="/all-picks" />
      <p className="mb-4 text-center text-sm text-muted">
        Everyone&rsquo;s picks are revealed at kickoff — until then you only see how many are in.
      </p>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {games.map((game) => {
          const gamePicks = visible.filter((p) => p.gameId === game.id)
          const hidden = hiddenCountByGame.get(game.id) ?? 0
          if (gamePicks.length === 0 && hidden === 0) return null
          return (
            <div key={game.id} className="rounded-xl border-2 border-line bg-surface p-5">
              <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
                {game.statusState === 'in' && game.statusDetail ? game.statusDetail : formatKickoff(game.kickoff)}
              </div>
              <div className="mb-3 font-semibold">
                {game.awayTeamName} @ {game.homeTeamName}
                {game.homeScore !== null && game.awayScore !== null && game.statusState !== 'pre' && (
                  <span className="ml-2 font-bold tabular-nums">
                    {game.awayScore}–{game.homeScore}
                    {game.completed && <span className="ml-1 text-xs uppercase text-muted">Final</span>}
                  </span>
                )}
              </div>

              {hidden > 0 && (
                <div className="mb-2 rounded-lg bg-surface-light px-4 py-3 text-center text-sm italic text-muted">
                  {hidden} pick{hidden > 1 ? 's' : ''} hidden until kickoff
                </div>
              )}

              {(['away', 'home'] as const).map((side) => {
                const sidePicks = gamePicks.filter((p) => p.side === side)
                if (sidePicks.length === 0) return null
                return (
                  <div key={side} className="mb-2 rounded-lg bg-surface-light px-4 py-3 last:mb-0">
                    <div className="mb-1.5 text-sm font-semibold">
                      {side === 'away' ? game.awayTeamName : game.homeTeamName}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sidePicks.map((p) => (
                        <span
                          key={p.userId}
                          className="flex items-center gap-2 rounded bg-background px-2.5 py-1 text-sm"
                        >
                          <strong>{p.displayName}</strong>
                          <span className="font-bold text-primary">{formatSpread(p.lockedSpread)}</span>
                          {p.result !== 'pending' && <ResultBadge result={p.result} />}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      {games.every((g) => (visible.filter((p) => p.gameId === g.id).length === 0 && !hiddenCountByGame.get(g.id))) && (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          No picks for week {ctx.week} yet.
        </p>
      )}
    </Shell>
  )
}
