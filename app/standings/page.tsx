import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { getPlayerStandings, getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import { rankByWeek, type PlayerStandings, type Totals, type WeekTotals } from '@/lib/picks/standings'
import { Shell } from '@/components/Shell'

export const dynamic = 'force-dynamic'

const RANK_COLORS = ['text-gold', 'text-silver', 'text-bronze']

const DESKTOP_COLS = 'md:grid-cols-[64px_1fr_90px_70px_70px_70px_90px]'
const MOBILE_COLS = 'grid-cols-[40px_1fr_64px_84px_44px]'
const headerCell = 'text-[11px] font-bold tracking-[.1em] text-muted'

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const user = await requireUser()
  const season = await getCurrentSeason()
  const currentWeek = season ? await getCurrentWeek(season) : null
  const players = season ? await getPlayerStandings(season) : []

  // Weeks anyone has picked in, oldest first.
  const weeks = [...new Set(players.flatMap((p) => [...p.weeks.keys()]))].sort((a, b) => a - b)
  const requested = parseInt((await searchParams).week ?? '', 10)
  const view: number | 'season' = weeks.includes(requested) ? requested : 'season'

  const ranked = view === 'season' ? players : rankByWeek(players, view)
  const totalsFor = (p: PlayerStandings): Totals | null =>
    view === 'season' ? p.season : (p.weeks.get(view) ?? null)

  return (
    <Shell user={user} week={currentWeek}>
      {weeks.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-hairline px-7 py-3.5 max-lg:px-4">
          <ViewChip href="/standings" active={view === 'season'} label="SEASON" />
          <span className="ml-1 text-[11px] font-bold tracking-[.12em] text-muted">WEEK</span>
          {weeks.map((w) => (
            <ViewChip key={w} href={`/standings?week=${w}`} active={view === w} label={String(w)} />
          ))}
        </div>
      )}
      <div className="mx-auto max-w-[900px] px-7 pb-10 pt-6 max-lg:px-3.5">
        {players.length === 0 ? (
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
                  <span className="max-md:hidden">{view === 'season' ? 'PARLAYS' : 'PARLAY'}</span>
                </span>
              </div>
              {ranked.map((p, i) => {
                const you = p.userId === user.id
                const t = totalsFor(p)
                const weekPending = view !== 'season' && p.weeks.get(view)?.graded === false
                return (
                  <div
                    key={p.userId}
                    className={`grid items-center border-b border-hairline px-[18px] py-[13px] last:border-b-0 ${MOBILE_COLS} ${DESKTOP_COLS} ${
                      you ? 'bg-accent/6' : ''
                    } ${t === null ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`font-extrabold ${i < 3 && t ? 'text-[17px]' : 'text-[15px]'} ${
                        (t && RANK_COLORS[i]) ?? 'text-muted'
                      }`}
                    >
                      {t ? i + 1 : '–'}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {p.displayName}
                      {you && (
                        <span className="rounded-[4px] border border-accent/50 px-[5px] py-0.5 text-[9px] font-extrabold tracking-[.1em] text-accent">
                          YOU
                        </span>
                      )}
                      {weekPending && (
                        <span className="text-[10px] font-bold tracking-[.08em] text-slate">LIVE</span>
                      )}
                    </span>
                    <span className="text-right text-[17px] font-extrabold tabular-nums">
                      {t ? t.points : '—'}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 max-md:hidden">
                      {t?.wins ?? '—'}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 max-md:hidden">
                      {t?.losses ?? '—'}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 max-md:hidden">
                      {t?.pushes ?? '—'}
                    </span>
                    <span className="text-right text-[13px] tabular-nums text-ink-2 md:hidden">
                      {t ? `${t.wins}–${t.losses}–${t.pushes}` : '—'}
                    </span>
                    <span
                      className={`text-right text-[13px] font-bold ${
                        t && t.parlays > 0 ? 'text-amber' : 'text-muted'
                      }`}
                    >
                      {t && t.parlays > 0 ? `★ ${view === 'season' ? t.parlays : ''}`.trim() : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-center text-xs text-muted">
              {view === 'season'
                ? '1 pt per cover · +1 for a 3-for-3 parlay · pushes score 0 and kill the parlay'
                : `Week ${view} only · players without picks that week sit at the bottom`}
            </p>

            <WeekGrid players={players} weeks={weeks} currentWeek={currentWeek} viewerId={user.id} />
          </>
        )}
      </div>
    </Shell>
  )
}

function ViewChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-md px-[11px] py-1 text-[13px] font-bold ${
        active ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:text-ink'
      }`}
    >
      {label}
    </Link>
  )
}

/** Player × week points grid — the season at a glance. Row order follows season rank. */
function WeekGrid({
  players,
  weeks,
  currentWeek,
  viewerId,
}: {
  players: PlayerStandings[]
  weeks: number[]
  currentWeek: number | null
  viewerId: number
}) {
  if (weeks.length < 2) return null
  return (
    <div className="mt-6 rounded-[14px] border border-card bg-surface px-5 py-[18px]">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[.06em]">WEEK BY WEEK</span>
        <span className="text-[10px] text-muted sm:hidden">← swipe for earlier weeks</span>
      </div>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[520px]"
          style={{ gridTemplateColumns: `150px repeat(${weeks.length}, minmax(44px, 1fr)) 60px` }}
        >
          <span className="border-b border-control px-1.5 py-2 text-[11px] font-bold tracking-[.1em] text-muted">
            PLAYER
          </span>
          {weeks.map((w) => (
            <Link
              key={w}
              href={`/standings?week=${w}`}
              className={`border-b border-control px-1.5 py-2 text-center text-[11px] font-bold tracking-[.1em] hover:text-ink ${
                w === currentWeek ? 'text-accent' : 'text-muted'
              }`}
            >
              W{w}
            </Link>
          ))}
          <span className="border-b border-control px-1.5 py-2 text-right text-[11px] font-bold tracking-[.1em] text-muted">
            TOTAL
          </span>
          {players.map((p, i) => {
            const last = i === players.length - 1
            const border = last ? '' : 'border-b border-hairline'
            const you = p.userId === viewerId
            return (
              <div key={p.userId} className="contents">
                <span
                  className={`flex items-center gap-[7px] px-1.5 py-2.5 text-[13px] font-bold ${border} ${
                    you ? 'text-accent-text' : ''
                  }`}
                >
                  <span className="truncate">{p.displayName}</span>
                </span>
                {weeks.map((w) => (
                  <span key={w} className={`flex items-center justify-center px-1.5 py-2.5 ${border}`}>
                    <GridCell week={p.weeks.get(w)} future={currentWeek !== null && w > currentWeek} />
                  </span>
                ))}
                <span
                  className={`px-1.5 py-2.5 text-right text-[13px] font-extrabold tabular-nums ${border}`}
                >
                  {p.season.points}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Points per week · ★ = parlay · &ldquo;—&rdquo; = no picks · blue = still in progress
      </p>
    </div>
  )
}

function GridCell({
  week,
  future,
}: {
  week: WeekTotals | undefined
  future: boolean
}) {
  if (!week) {
    return <span className="text-[11px] text-muted">{future ? '·' : '—'}</span>
  }
  const tint = !week.graded
    ? 'bg-slate/15 text-slate'
    : week.parlays > 0
      ? 'bg-amber/15 text-amber'
      : week.points > 0
        ? 'bg-green/15 text-green'
        : 'bg-strong/60 text-muted'
  return (
    <span className={`rounded-[5px] px-2 py-[3px] text-[11px] font-extrabold tabular-nums ${tint}`}>
      {week.points}
      {week.parlays > 0 && ' ★'}
    </span>
  )
}
