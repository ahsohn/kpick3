import { requireUser } from '@/lib/auth/session'
import { getGamesForWeek, getVisibleWeekPicks } from '@/lib/picks/queries'
import { resolveWeek } from '@/lib/picks/page-data'
import { getLiveOverlays, withLive } from '@/lib/espn/live'
import { Shell } from '@/components/Shell'
import { WeekSelector } from '@/components/WeekSelector'
import { formatKickoffDay, formatKickoffTime, formatSpread } from '@/lib/format'
import type { PickResult } from '@/lib/picks/grading'

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
        <div className="mx-auto max-w-[1100px] px-7 py-6 max-lg:px-4">
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">No games yet.</p>
        </div>
      </Shell>
    )
  }

  const [gamesRaw, { visible, hiddenCountByGame }, overlays] = await Promise.all([
    getGamesForWeek(ctx.season, ctx.week),
    getVisibleWeekPicks(ctx.season, ctx.week),
    getLiveOverlays(),
  ])
  const games = gamesRaw.map((g) => withLive(g, overlays))
  const shown = games.filter(
    (g) => visible.some((p) => p.gameId === g.id) || (hiddenCountByGame.get(g.id) ?? 0) > 0
  )

  return (
    <Shell user={user} week={ctx.currentWeek}>
      <WeekSelector weeks={ctx.weeks} current={ctx.week} basePath="/all-picks" />
      <div className="mx-auto max-w-[1100px] px-7 pb-10 pt-6 max-lg:px-3.5">
        <p className="mb-4 text-center text-[13px] text-muted">
          Everyone&rsquo;s picks reveal at kickoff — before that you only see how many are in.
        </p>

        {shown.length === 0 ? (
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            No picks for week {ctx.week} yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
            {shown.map((game) => {
              const gamePicks = visible.filter((p) => p.gameId === game.id)
              const hidden = hiddenCountByGame.get(game.id) ?? 0
              const live = game.statusState === 'in'
              const score =
                game.statusState !== 'pre' && game.homeScore !== null && game.awayScore !== null
                  ? `${game.awayScore}–${game.homeScore}`
                  : null
              return (
                <div key={game.id} className="rounded-xl border border-card bg-surface px-[18px] py-4">
                  <div className="mb-0.5">
                    {live ? (
                      <span className="flex items-center gap-1.5">
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
                        <span className="text-[11px] font-extrabold tracking-[.1em] text-accent">
                          LIVE · {game.statusDetail}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold tracking-[.1em] text-muted">
                        {formatKickoffDay(game.kickoff)} ·{' '}
                        {game.canceled
                          ? 'CANCELED'
                          : game.completed
                            ? 'FINAL'
                            : `${formatKickoffTime(game.kickoff)} ET`}
                      </span>
                    )}
                  </div>
                  <div className="mb-3 text-base font-extrabold">
                    {game.awayTeamName} @ {game.homeTeamName}
                    {score && <span className="ml-2 tabular-nums text-ink-2">{score}</span>}
                  </div>

                  {(['away', 'home'] as const).map((side) => {
                    const sidePicks = gamePicks.filter((p) => p.side === side)
                    if (sidePicks.length === 0) return null
                    return (
                      <div key={side} className="mb-2 rounded-[10px] bg-surface-3 px-3 py-2.5 last:mb-0">
                        <div className="mb-2 text-xs font-bold text-ink-2">
                          {side === 'away' ? game.awayTeamName : game.homeTeamName}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sidePicks.map((p) => (
                            <span
                              key={p.userId}
                              className="flex items-center gap-[7px] rounded-[7px] border border-control bg-header px-[9px] py-[5px] text-xs"
                            >
                              <strong>{p.displayName}</strong>
                              <span className="tabular-nums text-muted">{formatSpread(p.lockedSpread)}</span>
                              <ChipResult result={p.result} live={!game.completed} />
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {hidden > 0 && (
                    <div className="mt-2 rounded-[10px] border border-dashed border-strong p-3.5 text-center text-xs italic text-muted first:mt-0">
                      🔒 {hidden} pick{hidden > 1 ? 's' : ''} hidden until kickoff
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Shell>
  )
}

function ChipResult({ result, live }: { result: PickResult; live: boolean }) {
  if (result === 'pending') {
    return <span className="font-extrabold text-slate">{live ? 'LIVE' : 'PENDING'}</span>
  }
  const color = {
    win: 'text-green',
    loss: 'text-accent',
    push: 'text-amber',
    void: 'text-muted',
  }[result]
  return <span className={`font-extrabold ${color}`}>{result.toUpperCase()}</span>
}
