import { requireUser } from '@/lib/auth/session'
import { getCurrentSeason, getCurrentWeek, getRevealedSeasonPicks } from '@/lib/picks/queries'
import { commonPickPairs } from '@/lib/picks/pairs'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

const TOP_PAIRS = 15

export default async function StatsPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null
  const revealed = season ? await getRevealedSeasonPicks(season) : []
  const pairs = commonPickPairs(revealed).slice(0, TOP_PAIRS)

  return (
    <Shell user={user} week={currentWeek}>
      <div className="mx-auto max-w-[900px] px-7 pb-10 pt-6 max-lg:px-3.5">
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-[.06em]">MOST PICKS IN COMMON</h2>
            <span className="text-xs text-muted">Revealed picks only · same team, same game</span>
          </div>
          {pairs.length === 0 ? (
            <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
              No two players have a revealed pick in common yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-card bg-surface">
              <div className="grid grid-cols-[40px_1fr_72px] border-b border-control bg-surface-2 px-[18px] py-3">
                <span className="text-[11px] font-bold tracking-[.1em] text-muted">#</span>
                <span className="text-[11px] font-bold tracking-[.1em] text-muted">PLAYERS</span>
                <span className="text-right text-[11px] font-bold tracking-[.1em] text-muted">SHARED</span>
              </div>
              {pairs.map((p, i) => {
                const you = p.a.userId === user.id || p.b.userId === user.id
                const name = (who: typeof p.a) => (
                  <span className={who.userId === user.id ? 'font-extrabold text-accent-text' : 'font-semibold text-ink'}>
                    {who.displayName}
                  </span>
                )
                return (
                  <div
                    key={`${p.a.userId}-${p.b.userId}`}
                    className={`grid grid-cols-[40px_1fr_72px] items-center border-b border-hairline px-[18px] py-3 last:border-b-0 ${
                      you ? 'bg-accent/5' : ''
                    }`}
                  >
                    <span className="text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[14px]">
                      {name(p.a)}
                      <span className="text-muted">&amp;</span>
                      {name(p.b)}
                      <span className="text-xs text-placeholder">
                        of {Math.min(p.a.picks, p.b.picks)} possible
                      </span>
                    </span>
                    <span className="text-right text-[17px] font-extrabold tabular-nums">{p.shared}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </Shell>
  )
}
