import { db } from '@/lib/db'
import { games, survivorEntries, survivorPicks, users } from '@/lib/db/schema'
import { and, asc, eq, ne } from 'drizzle-orm'
import { getCurrentSeason, getCurrentWeek } from '@/lib/picks/queries'
import {
  computeChampions,
  computeSurvivorStatus,
  type ChampionOutcome,
  type SurvivorResult,
  type SurvivorStatus,
  type SurvivorWeekInfo,
} from './logic'

export async function isEnrolled(userId: number, season: number): Promise<boolean> {
  const rows = await db
    .select({ id: survivorEntries.id })
    .from(survivorEntries)
    .where(and(eq(survivorEntries.userId, userId), eq(survivorEntries.season, season)))
    .limit(1)
  return rows.length > 0
}

/** Teams already burned this season. Void picks (canceled games) don't count. */
export async function getUsedTeams(userId: number, season: number): Promise<Set<string>> {
  const rows = await db
    .select({ teamAbbr: survivorPicks.teamAbbr })
    .from(survivorPicks)
    .where(and(
      eq(survivorPicks.userId, userId),
      eq(survivorPicks.season, season),
      ne(survivorPicks.result, 'void'),
    ))
  return new Set(rows.map((r) => r.teamAbbr))
}

/** The caller's pick for a week — the live (non-void) one if a void was replaced. */
export async function getUserSurvivorPickForWeek(userId: number, season: number, week: number) {
  const rows = await db
    .select()
    .from(survivorPicks)
    .where(and(
      eq(survivorPicks.userId, userId),
      eq(survivorPicks.season, season),
      eq(survivorPicks.week, week),
      ne(survivorPicks.result, 'void'),
    ))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Week facts for the status/champion derivations: last kickoff and graded state of
 * every week that has at least one non-canceled game, ascending.
 */
async function getWeekInfos(season: number): Promise<SurvivorWeekInfo[]> {
  const rows = await db
    .select({ week: games.week, kickoff: games.kickoff, gradedAt: games.gradedAt })
    .from(games)
    .where(and(eq(games.season, season), eq(games.canceled, false)))
    .orderBy(asc(games.week))

  const byWeek = new Map<number, SurvivorWeekInfo>()
  for (const r of rows) {
    const info = byWeek.get(r.week)
    if (!info) {
      byWeek.set(r.week, {
        week: r.week,
        lastKickoff: r.kickoff,
        fullyGraded: r.gradedAt !== null,
      })
    } else {
      if (r.kickoff > info.lastKickoff) info.lastKickoff = r.kickoff
      if (r.gradedAt === null) info.fullyGraded = false
    }
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week)
}

export type SurvivorGridCell =
  | { kind: 'pick'; teamAbbr: string; teamLogo: string; result: SurvivorResult }
  | { kind: 'hidden' }   // pick exists but its game hasn't kicked off (not the viewer's)
  | { kind: 'missed' }   // decided week with no pick — the fatal miss

export interface SurvivorGridRow {
  userId: number
  displayName: string
  status: SurvivorStatus
  cells: Map<number, SurvivorGridCell>
}

export interface SurvivorSeasonData {
  entered: boolean          // is the viewer in the pool?
  weeks: number[]
  aliveCount: number
  entryCount: number
  champions: ChampionOutcome
  rows: SurvivorGridRow[]
}

/**
 * Everything the /survivor page needs, in one pass. Visibility is enforced here,
 * server-side: another player's pick stays hidden until its game kicks off (the viewer
 * always sees their own).
 */
export async function getSurvivorSeasonData(
  season: number,
  viewerId: number
): Promise<SurvivorSeasonData> {
  const [entries, pickRows, weekInfos] = await Promise.all([
    db
      .select({ userId: survivorEntries.userId, displayName: users.displayName })
      .from(survivorEntries)
      .innerJoin(users, eq(users.id, survivorEntries.userId))
      .where(eq(survivorEntries.season, season))
      .orderBy(asc(users.displayName)),
    db
      .select({
        userId: survivorPicks.userId,
        week: survivorPicks.week,
        result: survivorPicks.result,
        teamAbbr: survivorPicks.teamAbbr,
        side: survivorPicks.side,
        kickoff: games.kickoff,
        homeTeamLogo: games.homeTeamLogo,
        awayTeamLogo: games.awayTeamLogo,
      })
      .from(survivorPicks)
      .innerJoin(games, eq(games.id, survivorPicks.gameId))
      .where(eq(survivorPicks.season, season))
      .orderBy(asc(survivorPicks.week), asc(survivorPicks.createdAt)),
    getWeekInfos(season),
  ])

  const now = new Date()
  const currentWeek = await getCurrentWeek(season)
  // The grid only shows weeks that have arrived — decided weeks plus the one in play.
  const shownInfos = weekInfos.filter((w) => w.week <= currentWeek)
  const weeks = shownInfos.map((w) => w.week)

  const picksByUser = new Map<number, typeof pickRows>()
  for (const p of pickRows) {
    if (!picksByUser.has(p.userId)) picksByUser.set(p.userId, [])
    picksByUser.get(p.userId)!.push(p)
  }

  const statuses = new Map<number, SurvivorStatus>()
  const rows: SurvivorGridRow[] = entries.map((e) => {
    const myPicks = picksByUser.get(e.userId) ?? []
    const status = computeSurvivorStatus(
      myPicks.map((p) => ({ week: p.week, result: p.result as SurvivorResult })),
      weekInfos,
      now
    )
    statuses.set(e.userId, status)

    const cells = new Map<number, SurvivorGridCell>()
    for (const p of myPicks) {
      if (p.kickoff > now && p.userId !== viewerId) {
        cells.set(p.week, { kind: 'hidden' })
      } else {
        cells.set(p.week, {
          kind: 'pick',
          teamAbbr: p.teamAbbr,
          teamLogo: p.side === 'home' ? p.homeTeamLogo : p.awayTeamLogo,
          result: p.result as SurvivorResult,
        })
      }
    }
    if (status.eliminatedReason === 'missed' && status.eliminatedWeek !== null) {
      cells.set(status.eliminatedWeek, { kind: 'missed' })
    }
    return { userId: e.userId, displayName: e.displayName, status, cells }
  })

  // Alive players first, then the fallen (most recent elimination first).
  rows.sort((a, b) => {
    if (a.status.alive !== b.status.alive) return a.status.alive ? -1 : 1
    if (!a.status.alive) {
      const diff = (b.status.eliminatedWeek ?? 0) - (a.status.eliminatedWeek ?? 0)
      if (diff !== 0) return diff
    }
    return a.displayName.localeCompare(b.displayName)
  })

  return {
    entered: entries.some((e) => e.userId === viewerId),
    weeks,
    aliveCount: rows.filter((r) => r.status.alive).length,
    entryCount: entries.length,
    champions: computeChampions(statuses, weekInfos),
    rows,
  }
}

/** Derived status for one enrolled player (used by actions and the admin panel). */
export async function getSurvivorStatusForUser(
  userId: number,
  season: number
): Promise<SurvivorStatus> {
  const [myPicks, weekInfos] = await Promise.all([
    db
      .select({ week: survivorPicks.week, result: survivorPicks.result })
      .from(survivorPicks)
      .where(and(eq(survivorPicks.userId, userId), eq(survivorPicks.season, season))),
    getWeekInfos(season),
  ])
  return computeSurvivorStatus(
    myPicks.map((p) => ({ week: p.week, result: p.result as SurvivorResult })),
    weekInfos,
    new Date()
  )
}

export interface SurvivorBannerStatus {
  week: number
  state: 'normal' | 'warning' | 'missed'
  remainingPickable: number
  nextKickoffIso: string | null
}

/**
 * Homepage banner state for a signed-in user; null means render nothing (not enrolled,
 * already picked, eliminated in a past week, or no season yet). Escalates from a
 * reminder to a warning once the week's games start kicking off, and flips to the bad
 * news once no pickable game remains.
 */
export async function getSurvivorBannerStatus(
  userId: number
): Promise<SurvivorBannerStatus | null> {
  const season = await getCurrentSeason()
  if (season === null) return null
  if (!(await isEnrolled(userId, season))) return null

  const week = await getCurrentWeek(season)
  if (await getUserSurvivorPickForWeek(userId, season, week)) return null

  const status = await getSurvivorStatusForUser(userId, season)
  if (!status.alive && status.eliminatedWeek !== week) return null
  if (!status.alive && status.eliminatedReason !== 'missed') return null

  const [weekGames, used] = await Promise.all([
    db
      .select({
        kickoff: games.kickoff,
        statusState: games.statusState,
        canceled: games.canceled,
        homeTeamAbbr: games.homeTeamAbbr,
        awayTeamAbbr: games.awayTeamAbbr,
      })
      .from(games)
      .where(and(eq(games.season, season), eq(games.week, week))),
    getUsedTeams(userId, season),
  ])

  const now = new Date()
  const pickable = weekGames.filter(
    (g) =>
      !g.canceled &&
      g.statusState === 'pre' &&
      g.kickoff > now &&
      (!used.has(g.homeTeamAbbr) || !used.has(g.awayTeamAbbr))
  )
  const anyStarted = weekGames.some((g) => !g.canceled && g.kickoff <= now)
  const nextKickoff = pickable.reduce<Date | null>(
    (min, g) => (min === null || g.kickoff < min ? g.kickoff : min),
    null
  )

  const state: SurvivorBannerStatus['state'] =
    pickable.length === 0 ? 'missed' : anyStarted ? 'warning' : 'normal'

  return {
    week,
    state,
    remainingPickable: pickable.length,
    nextKickoffIso: nextKickoff ? nextKickoff.toISOString() : null,
  }
}
