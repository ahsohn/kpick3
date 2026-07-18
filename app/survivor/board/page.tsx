import { requireUser } from '@/lib/auth/session'
import { getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import {
  getSurvivorSeasonData,
  type SurvivorGridCell,
  type SurvivorGridRow,
} from '@/lib/survivor/queries'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

export default async function SurvivorBoardPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()

  if (season === null) {
    return (
      <Shell user={user} week={null}>
        <div className="mx-auto max-w-[1000px] px-7 py-6 max-lg:px-4">
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            No games yet — the first ESPN sync hasn&rsquo;t run. Check back soon.
          </p>
        </div>
      </Shell>
    )
  }

  const currentWeek = await getCurrentWeek(season)
  const data = await getSurvivorSeasonData(season, user.id)
  const championNames = data.rows
    .filter((r) => data.champions.championUserIds.includes(r.userId))
    .map((r) => r.displayName)

  return (
    <Shell user={user} week={currentWeek}>
      <div className="mx-auto max-w-[1000px] px-7 pb-10 pt-6 max-lg:px-3.5">
        {/* status card */}
        <div className="mb-3.5 flex items-center justify-between gap-3.5 rounded-xl border border-card bg-surface px-5 py-4">
          <div>
            <div className="text-[15px] font-extrabold tracking-[.06em]">SURVIVOR POOL</div>
            <div className="mt-1 text-[13px] text-muted">
              {data.champions.over
                ? `${championNames.length > 1 ? '🏆 Co-Champions' : '🏆 Champion'}: ${championNames.join(' · ')} — decided in week ${data.champions.decidedWeek}`
                : 'Picks reveal at kickoff — until then just “IN”'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold tabular-nums">
              <span className="text-green">{data.aliveCount}</span>
              <span className="text-muted"> / {data.entryCount}</span>
            </div>
            <div className="text-[11px] font-bold tracking-[.1em] text-muted">STILL ALIVE</div>
          </div>
        </div>

        {data.entryCount === 0 ? (
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            Nobody&rsquo;s enrolled yet — the commissioner adds players in the admin panel.
          </p>
        ) : (
          <div className="rounded-[14px] border border-card bg-surface px-5 py-[18px]">
            <p className="mb-2 text-right text-[10px] text-muted sm:hidden">← swipe for earlier weeks</p>
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[560px]"
                style={{ gridTemplateColumns: `160px repeat(${data.weeks.length}, minmax(56px, 1fr))` }}
              >
                <span className="border-b border-control px-1.5 py-2 text-[11px] font-bold tracking-[.1em] text-muted">
                  PLAYER
                </span>
                {data.weeks.map((w) => (
                  <span
                    key={w}
                    className={`border-b border-control px-1.5 py-2 text-center text-[11px] font-bold tracking-[.1em] ${
                      w === currentWeek ? 'text-amber' : 'text-muted'
                    }`}
                  >
                    W{w}
                  </span>
                ))}
                {data.rows.map((row, i) => (
                  <BoardRow
                    key={row.userId}
                    row={row}
                    weeks={data.weeks}
                    isViewer={row.userId === user.id}
                    last={i === data.rows.length - 1}
                  />
                ))}
              </div>
            </div>
            <p className="mb-0 mt-3 text-[11px] text-muted">
              Each team usable once a season · a tie or a missed week counts as a loss · &ldquo;—&rdquo; = no
              pick
            </p>
          </div>
        )}
      </div>
    </Shell>
  )
}

function BoardRow({
  row,
  weeks,
  isViewer,
  last,
}: {
  row: SurvivorGridRow
  weeks: number[]
  isViewer: boolean
  last: boolean
}) {
  const out = !row.status.alive
  const border = last ? '' : 'border-b border-hairline'
  const dim = out ? 'opacity-45' : ''
  return (
    <>
      <span className={`flex items-center gap-[7px] px-1.5 py-2.5 text-[13px] font-bold ${border} ${dim}`}>
        {row.displayName}
        {isViewer && (
          <span className="rounded-[4px] border border-accent/50 px-1 py-px text-[9px] font-extrabold tracking-[.1em] text-accent">
            YOU
          </span>
        )}
        {out && (
          <span className="whitespace-nowrap text-[10px] font-extrabold text-accent">
            ✕ WK {row.status.eliminatedWeek}
          </span>
        )}
      </span>
      {weeks.map((w) => (
        <span key={w} className={`flex items-center justify-center px-1.5 py-2.5 ${border} ${dim}`}>
          <BoardCell
            cell={row.cells.get(w)}
            pastElimination={out && w > (row.status.eliminatedWeek ?? 99)}
          />
        </span>
      ))}
    </>
  )
}

function BoardCell({
  cell,
  pastElimination,
}: {
  cell: SurvivorGridCell | undefined
  pastElimination: boolean
}) {
  if (!cell) {
    return <span className="text-[11px] text-muted">{pastElimination ? '·' : '·'}</span>
  }
  if (cell.kind === 'hidden') {
    return (
      <span className="rounded-[5px] bg-amber/15 px-2 py-[3px] text-[10px] font-extrabold text-amber">IN</span>
    )
  }
  if (cell.kind === 'missed') {
    return (
      <span className="rounded-[5px] bg-accent/15 px-2 py-[3px] text-[11px] font-extrabold text-accent">—</span>
    )
  }
  const tint = {
    win: 'bg-green/15 text-green',
    loss: 'bg-accent/15 text-accent',
    void: 'bg-strong/60 text-muted',
    pending: 'bg-slate/15 text-slate',
  }[cell.result]
  return (
    <span className={`rounded-[5px] px-2 py-[3px] text-[11px] font-extrabold ${tint}`}>{cell.teamAbbr}</span>
  )
}
