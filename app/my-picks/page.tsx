import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, picks } from '@/lib/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { Shell } from '@/components/Shell'
import { getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { weeklyPoints, type PickResult } from '@/lib/picks/grading'
import { formatKickoff, formatSpread } from '@/lib/format'
import { ResultBadge } from '@/components/ResultBadge'

export const dynamic = 'force-dynamic'

export default async function MyPicksPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null

  const rows = season
    ? await db
        .select({ pick: picks, game: games })
        .from(picks)
        .innerJoin(games, eq(games.id, picks.gameId))
        .where(and(eq(picks.userId, user.id), eq(picks.season, season)))
        .orderBy(desc(picks.week), games.kickoff)
    : []

  const byWeek = new Map<number, typeof rows>()
  for (const r of rows) {
    if (!byWeek.has(r.pick.week)) byWeek.set(r.pick.week, [])
    byWeek.get(r.pick.week)!.push(r)
  }

  return (
    <Shell user={user} week={currentWeek}>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          You haven&rsquo;t made any picks yet — head to Make Picks to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {[...byWeek.entries()].map(([week, weekRows]) => {
            const results = weekRows.map((r) => r.pick.result as PickResult)
            const { points, parlay } = weeklyPoints(results)
            const allGraded = results.every((r) => r !== 'pending')
            return (
              <section key={week} className="rounded-xl border border-line bg-surface p-5">
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="ff-display text-3xl text-primary">Week {week}</h2>
                  <div className="text-sm font-semibold text-muted">
                    {allGraded ? (
                      <>
                        {points} pt{points === 1 ? '' : 's'}
                        {parlay && <span className="ml-2 text-warning">🎉 PARLAY +1</span>}
                      </>
                    ) : (
                      `${results.filter((r) => r === 'pending').length} pending`
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {weekRows.map(({ pick, game }) => {
                    const teamName = pick.side === 'home' ? game.homeTeamName : game.awayTeamName
                    return (
                      <div
                        key={pick.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-light px-4 py-3"
                      >
                        <div>
                          <strong className="text-base">{teamName}</strong>
                          <span className="ml-2 font-bold text-primary">{formatSpread(pick.lockedSpread)}</span>
                          <div className="mt-0.5 text-sm text-muted">
                            {game.awayTeamAbbr} @ {game.homeTeamAbbr} · {formatKickoff(game.kickoff)}
                            {game.homeScore !== null && game.awayScore !== null && (
                              <span className="ml-2 font-semibold text-ink">
                                {game.awayScore}–{game.homeScore}
                                {game.statusState === 'in' && game.statusDetail ? ` · ${game.statusDetail}` : game.completed ? ' · Final' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <ResultBadge result={pick.result as PickResult} />
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </Shell>
  )
}
