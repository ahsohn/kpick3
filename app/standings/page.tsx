import { requireUser } from '@/lib/auth/session'
import { getStandings, getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

const RANK_COLORS = ['text-gold', 'text-silver', 'text-bronze']

const DESKTOP_COLS = 'md:grid-cols-[64px_1fr_90px_70px_70px_70px_90px]'
const MOBILE_COLS = 'grid-cols-[40px_1fr_64px_84px_44px]'
const headerCell = 'text-[11px] font-bold tracking-[.1em] text-muted'

export default async function StandingsPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null
  const standings = season ? await getStandings(season) : []

  return (
    <Shell user={user} week={currentWeek}>
      <div className="mx-auto max-w-[900px] px-7 pb-10 pt-6 max-lg:px-3.5">
        {standings.length === 0 ? (
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            No graded picks yet — standings appear after the first games go final.
          </p>
        ) : (
          <>
            <div className="overflow-hidden rounded-[14px] border border-card bg-surface">
              <div
                className={`grid border-b border-control bg-surface-2 px-[18px] py-3 ${MOBILE_COLS} ${DESKTOP_COLS}`}
              >
                <span className={headerCell}>
                  <span className="md:hidden">#</span>
                  <span className="max-md:hidden">RANK</span>
                </span>
                <span className={headerCell}>PLAYER</span>
                <span className={`${headerCell} text-right`}>
                  <span className="md:hidden">PTS</span>
                  <span className="max-md:hidden">POINTS</span>
                </span>
                <span className={`${headerCell} text-right max-md:hidden`}>W</span>
                <span className={`${headerCell} text-right max-md:hidden`}>L</span>
                <span className={`${headerCell} text-right max-md:hidden`}>PUSH</span>
                <span className={`${headerCell} text-right md:hidden`}>W–L–P</span>
                <span className={`${headerCell} text-right`}>
                  <span className="md:hidden">★</span>
                  <span className="max-md:hidden">PARLAYS</span>
                </span>
              </div>
              {standings.map((row, i) => {
                const you = row.userId === user.id
                return (
                  <div
                    key={row.userId}
                    className={`grid items-center border-b border-hairline px-[18px] py-[13px] last:border-b-0 ${MOBILE_COLS} ${DESKTOP_COLS} ${
                      you ? 'bg-accent/6' : ''
                    }`}
                  >
                    <span
                      className={`font-extrabold ${i < 3 ? 'text-[17px]' : 'text-[15px]'} ${
                        RANK_COLORS[i] ?? 'text-muted'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {row.displayName}
                      {you && (
                        <span className="rounded-[4px] border border-accent/50 px-[5px] py-0.5 text-[9px] font-extrabold tracking-[.1em] text-accent">
                          YOU
                        </span>
                      )}
                    </span>
                    <span className="text-right text-[17px] font-extrabold tabular-nums">{row.points}</span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 max-md:hidden">
                      {row.wins}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 max-md:hidden">
                      {row.losses}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 max-md:hidden">
                      {row.pushes}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 md:hidden">
                      {row.wins}–{row.losses}–{row.pushes}
                    </span>
                    <span
                      className={`text-right text-[13px] font-bold ${
                        row.parlays > 0 ? 'text-amber' : 'text-muted'
                      }`}
                    >
                      {row.parlays > 0 ? `★ ${row.parlays}` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              1 pt per cover · +1 for a 3-for-3 parlay · pushes score 0 and kill the parlay
            </p>
          </>
        )}
      </div>
    </Shell>
  )
}
