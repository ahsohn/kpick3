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

  // Season totals for the stat tiles
  let seasonPoints = 0
  let parlays = 0
  let wins = 0
  let losses = 0
  let pushes = 0
  for (const weekRows of byWeek.values()) {
    const results = weekRows.map((r) => r.pick.result as PickResult)
    const { points, parlay } = weeklyPoints(results)
    seasonPoints += points
    if (parlay) parlays++
    wins += results.filter((r) => r === 'win').length
    losses += results.filter((r) => r === 'loss').length
    pushes += results.filter((r) => r === 'push').length
  }

  return (
    <Shell user={user} week={currentWeek}>
      <div className="mx-auto flex max-w-[840px] flex-col gap-3.5 px-7 pb-10 pt-6 max-lg:px-3.5">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            You haven&rsquo;t made any picks yet — head to Make Picks to get started.
          </p>
        ) : (
          <>
            {/* stat tiles */}
            <div className="mb-1.5 flex gap-3.5 max-sm:flex-col">
              <StatTile label="SEASON POINTS" value={String(seasonPoints)} />
              <StatTile label="RECORD (ATS)" value={`${wins}–${losses}–${pushes}`} />
              <StatTile label="PARLAYS" value={parlays > 0 ? `${parlays} ★` : '0'} amber={parlays > 0} />
            </div>

            {/* week cards */}
            {[...byWeek.entries()].map(([week, weekRows]) => {
              const results = weekRows.map((r) => r.pick.result as PickResult)
              const { points, parlay } = weeklyPoints(results)
              const pendingCount = results.filter((r) => r === 'pending').length
              const allGraded = pendingCount === 0
              const slotsOpen = week === currentWeek ? 3 - weekRows.length : 0
              return (
                <section key={week} className="rounded-xl border border-card bg-surface px-5 py-[18px]">
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="text-base font-extrabold tracking-[.06em] text-accent">WEEK {week}</span>
                    {allGraded ? (
                      <span className={`text-xs font-extrabold ${parlay ? 'text-amber' : 'text-muted'}`}>
                        {points} PT{points === 1 ? '' : 'S'}
                        {parlay && ' · PARLAY ★ +1'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-muted">
                        {pendingCount} pending
                        {slotsOpen > 0 && ` · ${slotsOpen} slot${slotsOpen === 1 ? '' : 's'} open`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {weekRows.map(({ pick, game }) => {
                      const teamName = pick.side === 'home' ? game.homeTeamName : game.awayTeamName
                      const started = game.statusState !== 'pre'
                      const score =
                        started && game.homeScore !== null && game.awayScore !== null
                          ? `${game.awayScore}–${game.homeScore}`
                          : null
                      const detail = game.completed
                        ? `${game.awayTeamAbbr} @ ${game.homeTeamAbbr} · Final ${score ?? ''}`
                        : game.statusState === 'in'
                          ? `${game.awayTeamAbbr} @ ${game.homeTeamAbbr} · ${game.statusDetail ?? 'Live'}${score ? ` · ${score}` : ''}`
                          : `${game.awayTeamAbbr} @ ${game.homeTeamAbbr} · ${formatKickoff(game.kickoff)}`
                      return (
                        <div
                          key={pick.id}
                          className="flex items-center justify-between gap-3 rounded-[10px] bg-surface-3 px-3.5 py-3"
                        >
                          <div>
                            <span className="text-sm font-bold">
                              {teamName} {formatSpread(pick.lockedSpread)}
                            </span>
                            <div className="mt-0.5 text-xs text-muted">{detail}</div>
                          </div>
                          <ResultBadge result={pick.result as PickResult} />
                        </div>
                      )
                    })}
                    {week === currentWeek && slotsOpen > 0 && (
                      <div className="rounded-[10px] border border-dashed border-strong p-3 text-center text-xs text-muted">
                        Pick {slotsOpen === 3 ? '3' : `${slotsOpen} more`} still open — spreads lock when
                        you submit
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>
    </Shell>
  )
}

function StatTile({ label, value, amber }: { label: string; value: string; amber?: boolean }) {
  return (
    <div className="flex-1 rounded-xl border border-card bg-surface px-[18px] py-3.5">
      <div className="text-[11px] font-bold tracking-[.12em] text-muted">{label}</div>
      <div className={`text-[26px] font-extrabold tabular-nums ${amber ? 'text-amber' : ''}`}>{value}</div>
    </div>
  )
}
