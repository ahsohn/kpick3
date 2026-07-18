import Link from 'next/link'
import { requireUser } from '@/lib/auth/session'
import { getCurrentSeason, getCurrentWeek, getGamesForWeek } from '@/lib/picks/queries'
import {
  getSurvivorSeasonData,
  getUsedTeams,
  getUserSurvivorPickForWeek,
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
        <div className="mx-auto max-w-[840px] px-7 py-6 max-lg:px-4">
          <p className="rounded-xl border border-card bg-surface p-8 text-center text-muted">
            No games yet — the first ESPN sync hasn&rsquo;t run. Check back soon.
          </p>
        </div>
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
  const canPick = data.entered && (myRow?.status.alive ?? false) && !data.champions.over

  if (!canPick) {
    const isChampion = data.champions.championUserIds.includes(user.id)
    return (
      <Shell user={user} week={currentWeek}>
        <div className="mx-auto flex max-w-[840px] flex-col gap-3.5 px-7 py-6 max-lg:px-4">
          <div className="rounded-xl border border-card bg-surface p-8 text-center">
            {!data.entered ? (
              <p className="text-muted">
                You&rsquo;re not in this season&rsquo;s survivor pool — the commissioner adds players in the
                admin panel.
              </p>
            ) : isChampion ? (
              <p className="text-lg font-extrabold text-gold">
                🏆 You survived — champion of the {season} season!
              </p>
            ) : data.champions.over ? (
              <p className="text-muted">The survivor pool is decided for {season}.</p>
            ) : (
              <p className="text-muted">
                You went out in week {myRow?.status.eliminatedWeek}
                {myRow?.status.eliminatedReason === 'missed' ? ' (no pick)' : ''} — following along from
                the couch. 🛋️
              </p>
            )}
            <Link
              href="/survivor/board"
              className="mt-4 inline-block rounded-[10px] bg-amber px-5 py-2.5 text-[13px] font-extrabold tracking-[.05em] text-amber-ink hover:bg-amber-hover"
            >
              SEE THE BOARD
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell user={user} week={currentWeek}>
      <SurvivorPickPanel
        games={weekGames.map((g) => toBoardGame(withLive(g, overlays)))}
        usedTeams={[...usedTeams.entries()]
          .map(([abbr, week]) => ({ abbr, week }))
          .sort((a, b) => a.week - b.week)}
        myPick={
          myPick
            ? { gameId: myPick.gameId, side: myPick.side as 'home' | 'away', teamAbbr: myPick.teamAbbr }
            : null
        }
        week={currentWeek}
        aliveCount={data.aliveCount}
        entryCount={data.entryCount}
      />
    </Shell>
  )
}
