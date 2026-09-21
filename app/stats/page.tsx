import { requireUser } from '@/lib/auth/session'
import { getCurrentSeason, getCurrentWeek, getRevealedSeasonPicks } from '@/lib/picks/queries'
import { commonPickPairs } from '@/lib/picks/pairs'
import { favoriteTeams, type FavoriteTeamRow } from '@/lib/picks/favorite-teams'
import { TeamLogo } from '@/components/TeamLogo'
import { favoritesAndDogs, spreadTotals } from '@/lib/picks/tendencies'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

const TOP_PAIRS = 15
const TOP_LOYAL = 15
const headerCell = 'text-[11px] font-bold tracking-[.1em] text-muted'

export default async function StatsPage() {
  const user = await requireUser()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null
  const revealed = season ? await getRevealedSeasonPicks(season) : []
  const pairs = commonPickPairs(revealed).slice(0, TOP_PAIRS)
  const loyal = favoriteTeams(revealed).slice(0, TOP_LOYAL)
  const faded = favoriteTeams(
    revealed.map((p) => ({ ...p, teamAbbr: p.opponentAbbr, teamLogo: p.opponentLogo }))
  ).slice(0, TOP_LOYAL)
  const favDog = favoritesAndDogs(revealed)
  const totals = spreadTotals(revealed)
  const maxTotal = totals[0]?.total ?? 0

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

        <LoyaltyTable
          title="TEAM LOYALTY"
          helper="Each player’s most-picked team · picked at least twice"
          rows={loyal}
          viewerId={user.id}
        />

        <LoyaltyTable
          title="NO FAITH"
          helper="The team each player keeps betting against · at least twice"
          rows={faded}
          viewerId={user.id}
        />

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-[.06em]">FAVORITES &amp; DOGS</h2>
            <span className="text-xs text-muted">Laying points vs. taking them · record as wins/picks</span>
          </div>
          {favDog.length === 0 ? (
            <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">No revealed picks yet.</p>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-card bg-surface">
              <div className="grid grid-cols-[1fr_88px_88px_64px] border-b border-control bg-surface-2 px-[18px] py-3">
                <span className={headerCell}>PLAYER</span>
                <span className={`${headerCell} text-right`}>FAVS</span>
                <span className={`${headerCell} text-right`}>DOGS</span>
                <span className={`${headerCell} text-right`}>PK</span>
              </div>
              {favDog.map((r) => {
                const you = r.userId === user.id
                const sided = r.favorites.picks + r.dogs.picks
                const favPct = sided === 0 ? 0 : Math.round((100 * r.favorites.picks) / sided)
                return (
                  <div
                    key={r.userId}
                    className={`grid grid-cols-[1fr_88px_88px_64px] items-center border-b border-hairline px-[18px] py-3 last:border-b-0 ${
                      you ? 'bg-accent/5' : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span
                        className={`truncate text-[14px] ${you ? 'font-extrabold text-accent-text' : 'font-semibold text-ink'}`}
                      >
                        {r.displayName}
                      </span>
                      <span className="whitespace-nowrap text-xs text-placeholder">{favPct}% chalk</span>
                    </span>
                    <RecordCell picks={r.favorites.picks} wins={r.favorites.wins} />
                    <RecordCell picks={r.dogs.picks} wins={r.dogs.wins} />
                    <span className="text-right text-[15px] font-bold tabular-nums text-muted">{r.pickems}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-[.06em]">POINTS ON THE LINE</h2>
            <span className="text-xs text-muted">Sum of every locked line, ignoring sign · big numbers vs. small</span>
          </div>
          {totals.length === 0 ? (
            <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">No revealed picks yet.</p>
          ) : (
            <div className="rounded-[14px] border border-card bg-surface px-[18px] py-4">
              <div className="flex flex-col gap-2.5">
                {totals.map((r) => {
                  const you = r.userId === user.id
                  const width = maxTotal === 0 ? 0 : (100 * r.total) / maxTotal
                  return (
                    <div
                      key={r.userId}
                      className="grid grid-cols-[minmax(90px,160px)_1fr_auto] items-center gap-3"
                      title={`${r.displayName}: ${trimNum(r.total)} points over ${r.picks} pick${r.picks === 1 ? '' : 's'}, ${trimNum(r.average)} per pick`}
                    >
                      <span
                        className={`truncate text-[13px] ${you ? 'font-extrabold text-accent-text' : 'font-semibold text-ink'}`}
                      >
                        {r.displayName}
                      </span>
                      <span className="h-3.5 w-full overflow-hidden rounded-r-[4px] bg-surface-2">
                        <span
                          className={`block h-full rounded-r-[4px] ${you ? 'bg-accent' : 'bg-accent/55'}`}
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className="whitespace-nowrap text-right text-[13px] tabular-nums">
                        <span className="font-extrabold">{trimNum(r.total)}</span>
                        <span className="ml-1.5 text-xs text-placeholder">{trimNum(r.average)} avg</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </Shell>
  )
}

function LoyaltyTable({
  title,
  helper,
  rows,
  viewerId,
}: {
  title: string
  helper: string
  rows: FavoriteTeamRow[]
  viewerId: number
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-[.06em]">{title}</h2>
        <span className="text-xs text-muted">{helper}</span>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
          Nothing yet — a team has to be picked at least twice to count.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-card bg-surface">
          <div className="grid grid-cols-[40px_1fr_1fr_72px_80px] border-b border-control bg-surface-2 px-[18px] py-3">
            <span className={headerCell}>#</span>
            <span className={headerCell}>PLAYER</span>
            <span className={headerCell}>TEAM</span>
            <span className={`${headerCell} text-right`}>TIMES</span>
            <span className={`${headerCell} text-right`}>CORRECT</span>
          </div>
          {rows.map((r, i) => {
            const you = r.userId === viewerId
            return (
              <div
                key={r.userId}
                className={`grid grid-cols-[40px_1fr_1fr_72px_80px] items-center border-b border-hairline px-[18px] py-3 last:border-b-0 ${
                  you ? 'bg-accent/5' : ''
                }`}
              >
                <span className="text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                <span
                  className={`truncate text-[14px] ${you ? 'font-extrabold text-accent-text' : 'font-semibold text-ink'}`}
                >
                  {r.displayName}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {r.teams.map((t) => (
                    <span key={t.abbr} className="flex items-center gap-1.5 text-[13px] font-bold">
                      <TeamLogo src={t.logo} abbr={t.abbr} size={22} />
                      {t.abbr}
                    </span>
                  ))}
                </span>
                <span className="text-right text-[17px] font-extrabold tabular-nums">{r.count}</span>
                <span className="flex flex-col items-end text-[15px] font-bold tabular-nums text-muted">
                  {r.teams.map((t) => (
                    <span key={t.abbr}>
                      {t.wins}
                      <span className="text-xs font-semibold text-placeholder">/{r.count}</span>
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      )}
          </section>
    )
  }

/** "3/5" — wins over picks, muted when there are no picks at all. */
function RecordCell({ picks, wins }: { picks: number; wins: number }) {
  if (picks === 0) return <span className="text-right text-sm text-placeholder">—</span>
  return (
    <span className="text-right text-[15px] font-bold tabular-nums">
      {wins}
      <span className="text-xs font-semibold text-placeholder">/{picks}</span>
    </span>
  )
}

/** 23.5 → "23.5", 24 → "24", 11.75 → "11.8" */
function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}
