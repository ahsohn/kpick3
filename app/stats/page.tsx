import { requireUser } from '@/lib/auth/session'
import { getCurrentSeason, getCurrentWeek, getRevealedSeasonPicks } from '@/lib/picks/queries'
import { commonPickPairs } from '@/lib/picks/pairs'
import { favoriteTeams, type FavoriteTeamRow } from '@/lib/picks/favorite-teams'
import { TeamLogo } from '@/components/TeamLogo'
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
          <div className="grid grid-cols-[40px_1fr_1fr_72px] border-b border-control bg-surface-2 px-[18px] py-3">
            <span className={headerCell}>#</span>
            <span className={headerCell}>PLAYER</span>
            <span className={headerCell}>TEAM</span>
            <span className={`${headerCell} text-right`}>TIMES</span>
          </div>
          {rows.map((r, i) => {
            const you = r.userId === viewerId
            return (
              <div
                key={r.userId}
                className={`grid grid-cols-[40px_1fr_1fr_72px] items-center border-b border-hairline px-[18px] py-3 last:border-b-0 ${
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
              </div>
            )
          })}
        </div>
      )}
          </section>
    )
  }
