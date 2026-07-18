import { requireUser } from '@/lib/auth/session'
import { getCurrentSeason, getCurrentWeek, getGamesForWeek } from '@/lib/picks/queries'
import {
  getSurvivorSeasonData,
  getUsedTeams,
  getUserSurvivorPickForWeek,
  type SurvivorGridCell,
  type SurvivorGridRow,
} from '@/lib/survivor/queries'
import { getLiveOverlays, withLive } from '@/lib/espn/live'
import { Shell } from '@/components/Shell'
import { SurvivorPickPanel } from '@/components/SurvivorPickPanel'
import { toBoardGame } from '@/components/board-types'

export const dynamic = 'force-dynamic'

export default async function SurvivorPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()

  if (season === null) {
    return (
      <Shell user={user} week={null}>
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-muted">
          No games yet — the first ESPN sync hasn&rsquo;t run. Check back soon.
        </p>
      </Shell>
    )
  }

  const currentWeek = await getCurrentWeek(season)
  const [data, weekGames, myPick, usedTeams, overlays] = await Promise.all([
    getSurvivorSeasonData(season, user.id),
    getGamesForWeek(season, currentWeek),
    getUserSurvivorPickForWeek(user.id, season, currentWeek),
    getUsedTeams(user.id, season),
    getLiveOverlays(),
  ])

  const myRow = data.rows.find((r) => r.userId === user.id)
  const canPick = data.entered && (myRow?.status.alive ?? false)

  return (
    <Shell user={user} week={currentWeek}>
      {/* Pool status header */}
      <section className="mb-6 rounded-xl border border-line bg-surface p-5 text-center">
        <h1 className="ff-display text-3xl text-primary">Survivor Pool</h1>
        {data.entryCount === 0 ? (
          <p className="mt-1 text-sm text-muted">
            Nobody&rsquo;s enrolled yet — the commissioner adds players in the admin panel.
          </p>
        ) : data.champions.over ? (
          <div className="mt-2">
            <div className="ff-display text-2xl text-[#ffd700]">
              {data.champions.championUserIds.length > 1 ? '🏆 Co-Champions' : '🏆 Champion'}
            </div>
            <div className="mt-1 font-semibold">
              {data.rows
                .filter((r) => data.champions.championUserIds.includes(r.userId))
                .map((r) => r.displayName)
                .join(' · ')}
            </div>
            <p className="mt-1 text-xs text-muted">Decided in week {data.champions.decidedWeek}</p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">
            <strong className="text-ink">{data.aliveCount}</strong> of{' '}
            <strong className="text-ink">{data.entryCount}</strong> still alive · one straight-up
            winner a week · lose once and you&rsquo;re out
          </p>
        )}
      </section>

      {canPick && (
        <SurvivorPickPanel
          games={weekGames.map((g) => toBoardGame(withLive(g, overlays)))}
          usedTeamAbbrs={[...usedTeams].sort()}
          myPick={myPick ? { gameId: myPick.gameId, side: myPick.side as 'home' | 'away', teamAbbr: myPick.teamAbbr } : null}
          week={currentWeek}
        />
      )}

      {data.entered && myRow && !myRow.status.alive && !data.champions.championUserIds.includes(user.id) && (
        <p className="mb-6 rounded-xl border border-line bg-surface px-5 py-4 text-center text-muted">
          You went out in week {myRow.status.eliminatedWeek}
          {myRow.status.eliminatedReason === 'missed' ? ' (no pick)' : ''} — following along from
          the couch. 🛋️
        </p>
      )}

      {data.entryCount > 0 && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="ff-display mb-1 text-2xl text-primary">The Board</h2>
          <p className="mb-4 text-sm text-muted">
            Picks are revealed at kickoff. Until then you&rsquo;ll just see that a pick is in.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-3 py-2 font-semibold uppercase tracking-wider">Player</th>
                  {data.weeks.map((w) => (
                    <th key={w} className="px-2 py-2 text-center font-semibold uppercase tracking-wider">
                      W{w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <GridRow key={row.userId} row={row} weeks={data.weeks} isViewer={row.userId === user.id} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Shell>
  )
}

function GridRow({ row, weeks, isViewer }: { row: SurvivorGridRow; weeks: number[]; isViewer: boolean }) {
  const out = !row.status.alive
  return (
    <tr
      className={`border-b border-line last:border-b-0 ${out ? 'opacity-50' : ''} ${
        isViewer ? 'bg-primary/5' : ''
      }`}
    >
      <td className="whitespace-nowrap px-3 py-2 font-semibold">
        {row.displayName}
        {isViewer && (
          <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">you</span>
        )}
        {out && (
          <span className="ml-2 text-xs font-semibold uppercase text-danger">
            ❌ Wk {row.status.eliminatedWeek}
          </span>
        )}
      </td>
      {weeks.map((w) => (
        <td key={w} className="px-2 py-2 text-center">
          <Cell cell={row.cells.get(w)} pastElimination={out && w > (row.status.eliminatedWeek ?? 99)} />
        </td>
      ))}
    </tr>
  )
}

function Cell({ cell, pastElimination }: { cell: SurvivorGridCell | undefined; pastElimination: boolean }) {
  if (!cell) {
    return <span className="text-muted">{pastElimination ? '' : '·'}</span>
  }
  if (cell.kind === 'hidden') {
    return (
      <span className="inline-block rounded bg-secondary/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#7db3e8]">
        in
      </span>
    )
  }
  if (cell.kind === 'missed') {
    return <span className="inline-block rounded bg-danger/20 px-1.5 py-0.5 text-xs font-bold text-danger">—</span>
  }
  const tint = {
    win: 'bg-success/20 text-success',
    loss: 'bg-danger/20 text-danger',
    void: 'bg-line text-muted',
    pending: 'bg-secondary/40 text-[#7db3e8]',
  }[cell.result]
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${tint}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cell.teamLogo} alt="" className="h-4 w-4" />
      {cell.teamAbbr}
    </span>
  )
}
