import { requireUser } from '@/lib/auth/session'
import { getGamesForWeek, getVisibleWeekPicks } from '@/lib/picks/queries'
import { resolveWeek } from '@/lib/picks/page-data'
import { getLiveOverlays, withLive } from '@/lib/espn/live'
import { Shell } from '@/components/Shell'
import { WeekSelector } from '@/components/WeekSelector'
import { formatKickoffDay, formatKickoffTime, formatSpread, spreadForSide } from '@/lib/format'
import type { PickResult } from '@/lib/picks/grading'
import { TeamLogo } from '@/components/TeamLogo'
import { liveCover, LIVE_COVER_LABEL } from '@/lib/picks/live-cover'

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

  // Overlays first: that read also grades any newly-final game, so the picks
  // queried below already carry their results.
  const overlays = await getLiveOverlays()
  const [gamesRaw, { visible, hiddenCountByGame }] = await Promise.all([
    getGamesForWeek(ctx.season, ctx.week),
    getVisibleWeekPicks(ctx.season, ctx.week),
  ])
  const games = gamesRaw.map((g) => withLive(g, overlays))
  const shown = games.filter(
    (g) => visible.some((p) => p.gameId === g.id) || (hiddenCountByGame.get(g.id) ?? 0) > 0
  )

  return (
    <Shell user={user} week={ctx.currentWeek}>
      <WeekSelector weeks={ctx.weeks} current={ctx.week} basePath="/all-picks" helper="Picks reveal at kickoff" />
      <div className="mx-auto max-w-[1100px] px-7 pb-10 pt-6 max-lg:px-3.5">
        {shown.length === 0 ? (
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            No picks for week {ctx.week} yet.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,440px),1fr))] gap-3.5">
            {shown.map((game) => {
              const gamePicks = visible.filter((p) => p.gameId === game.id)
              const hidden = hiddenCountByGame.get(game.id) ?? 0
              const live = game.statusState === 'in'
              const pre = game.statusState === 'pre'
              const hasScore = !pre && game.homeScore !== null && game.awayScore !== null
              const finalLoser: 'home' | 'away' | null =
                game.completed && hasScore && game.homeScore !== game.awayScore
                  ? game.homeScore! > game.awayScore!
                    ? 'away'
                    : 'home'
                  : null
              return (
                <div
                  key={game.id}
                  className={`rounded-xl border bg-surface px-[18px] pb-4 pt-3.5 ${live ? 'border-accent/40' : 'border-card'}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    {live ? (
                      <span className="flex items-center gap-1.5">
                        <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
                        <span className="text-[11px] font-extrabold tracking-[.1em] text-accent">
                          LIVE · {game.statusDetail}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold tracking-[.1em] text-muted">
                        {formatKickoffDay(game.kickoff)} ·{' '}
                        {game.canceled
                          ? 'CANCELED'
                          : game.completed
                            ? 'FINAL'
                            : `${formatKickoffTime(game.kickoff)} ET`}
                      </span>
                    )}
                    <span className="text-[11px] font-semibold tracking-[.08em] text-placeholder">
                      {pre ? hidden : gamePicks.length} IN
                    </span>
                  </div>

                  <div className="grid grid-cols-2">
                    {(['away', 'home'] as const).map((side) => {
                      const sidePicks = gamePicks.filter((p) => p.side === side)
                      const name = side === 'away' ? game.awayTeamName : game.homeTeamName
                      const score = side === 'away' ? game.awayScore : game.homeScore
                      // Everyone on a side sits on the same locked line, so the line and
                      // result show once per side. If they ever differ (shouldn't happen),
                      // fall back to showing them per name.
                      const first = sidePicks[0]
                      const uniform =
                        sidePicks.length > 0 &&
                        sidePicks.every(
                          (p) => p.lockedSpread === first.lockedSpread && p.result === first.result
                        )
                      const line =
                        first !== undefined
                          ? formatSpread(first.lockedSpread)
                          : game.homeSpread === null
                            ? '—'
                            : formatSpread(spreadForSide(game.homeSpread, side))
                      const pill = (p: (typeof sidePicks)[number]) => (
                        <ResultPill
                          result={p.result}
                          cover={live ? liveCover(p.side, p.lockedSpread, game.homeScore, game.awayScore) : null}
                        />
                      )
                      const sorted = [...sidePicks].sort(
                        (a, b) => Number(b.userId === user.id) - Number(a.userId === user.id)
                      )
                      return (
                        <div
                          key={side}
                          className={`min-w-0 ${side === 'home' ? 'border-l border-card pl-4' : 'pr-4'}`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <TeamLogo
                              src={side === 'away' ? game.awayTeamLogo : game.homeTeamLogo}
                              abbr={side === 'away' ? game.awayTeamAbbr : game.homeTeamAbbr}
                              size={22}
                            />
                            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{name}</span>
                            {hasScore && (
                              <span
                                className={`text-[17px] font-extrabold tabular-nums ${finalLoser === side ? 'text-muted' : 'text-ink'}`}
                              >
                                {score}
                              </span>
                            )}
                          </div>
                          <div className="mb-2.5 flex min-h-5 flex-wrap items-center gap-2">
                            <span className="text-xs font-bold tabular-nums text-muted">{line}</span>
                            {uniform && pill(first)}
                          </div>
                          {sorted.length === 0 ? (
                            <span className="text-xs text-placeholder">No one</span>
                          ) : (
                            <div className="flex flex-col gap-[5px]">
                              {sorted.map((p) => (
                                <span
                                  key={p.userId}
                                  className={`flex flex-wrap items-center gap-2 text-[13px] ${
                                    p.userId === user.id ? 'font-extrabold text-accent-text' : 'font-semibold text-ink'
                                  }`}
                                >
                                  {p.displayName}
                                  {!uniform && (
                                    <>
                                      <span className="text-xs font-bold tabular-nums text-muted">
                                        {formatSpread(p.lockedSpread)}
                                      </span>
                                      {pill(p)}
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {hidden > 0 && (
                    <div className="mt-2 text-xs text-muted">
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

/** Bordered result pill; mid-game shows where the pick stands against its locked line. */
function ResultPill({ result, cover }: { result: PickResult; cover: ReturnType<typeof liveCover> }) {
  const base =
    'whitespace-nowrap rounded-[5px] border px-[7px] py-[2px] text-[10px] font-extrabold tracking-[.1em]'
  if (result === 'pending' && cover) {
    return <span className={`${base} ${LIVE_COVER_STYLE[cover]}`}>{LIVE_COVER_LABEL[cover]}</span>
  }
  const styles: Record<PickResult, string> = {
    win: 'text-green border-green/40',
    loss: 'text-accent border-accent/40',
    push: 'text-amber border-amber/40',
    void: 'text-muted border-muted/40',
    pending: 'text-slate border-slate/40',
  }
  return <span className={`${base} ${styles[result]}`}>{result.toUpperCase()}</span>
}

const LIVE_COVER_STYLE: Record<NonNullable<ReturnType<typeof liveCover>>, string> = {
  covering: 'text-green border-green/40',
  trailing: 'text-accent border-accent/40',
  'on-number': 'text-amber border-amber/40',
}
