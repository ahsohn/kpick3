import { db } from '@/lib/db'
import { games, picks, users, type Game, type Pick } from '@/lib/db/schema'
import { and, asc, desc, eq, max } from 'drizzle-orm'
import { weeklyPoints, type PickResult } from './grading'

/** Latest season present in the games table (null before the first sync). */
export async function getCurrentSeason(): Promise<number | null> {
  const rows = await db.select({ season: max(games.season) }).from(games)
  return rows[0]?.season ?? null
}

/**
 * The week players are currently picking: the earliest week of this season with an
 * unfinished, non-canceled game; falls back to the latest week when the season's over.
 */
export async function getCurrentWeek(season: number): Promise<number> {
  const open = await db
    .select({ week: games.week })
    .from(games)
    .where(and(
      eq(games.season, season),
      eq(games.completed, false),
      eq(games.canceled, false),
    ))
    .orderBy(asc(games.week))
    .limit(1)
  if (open[0]) return open[0].week

  const latest = await db
    .select({ week: games.week })
    .from(games)
    .where(eq(games.season, season))
    .orderBy(desc(games.week))
    .limit(1)
  return latest[0]?.week ?? 1
}

export async function getGamesForWeek(season: number, week: number): Promise<Game[]> {
  return db
    .select()
    .from(games)
    .where(and(eq(games.season, season), eq(games.week, week)))
    .orderBy(asc(games.kickoff), asc(games.id))
}

export async function getWeeksWithGames(season: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ week: games.week })
    .from(games)
    .where(eq(games.season, season))
    .orderBy(asc(games.week))
  return rows.map((r) => r.week)
}

export async function getUserPicksForWeek(
  userId: number,
  season: number,
  week: number
): Promise<Pick[]> {
  return db
    .select()
    .from(picks)
    .where(and(eq(picks.userId, userId), eq(picks.season, season), eq(picks.week, week)))
}

export interface StandingsRow {
  userId: number
  displayName: string
  points: number
  wins: number
  losses: number
  pushes: number
  parlays: number
}

/** Season standings, computed from graded picks (nothing stored to drift stale). */
export async function getStandings(season: number): Promise<StandingsRow[]> {
  const rows = await db
    .select({
      userId: picks.userId,
      displayName: users.displayName,
      week: picks.week,
      result: picks.result,
    })
    .from(picks)
    .innerJoin(users, eq(users.id, picks.userId))
    .where(eq(picks.season, season))

  const byUserWeek = new Map<string, { userId: number; displayName: string; results: PickResult[] }>()
  for (const r of rows) {
    const key = `${r.userId}:${r.week}`
    if (!byUserWeek.has(key)) {
      byUserWeek.set(key, { userId: r.userId, displayName: r.displayName, results: [] })
    }
    byUserWeek.get(key)!.results.push(r.result as PickResult)
  }

  const totals = new Map<number, StandingsRow>()
  for (const { userId, displayName, results } of byUserWeek.values()) {
    if (!totals.has(userId)) {
      totals.set(userId, {
        userId, displayName, points: 0, wins: 0, losses: 0, pushes: 0, parlays: 0,
      })
    }
    const t = totals.get(userId)!
    const { points, parlay } = weeklyPoints(results)
    t.points += points
    if (parlay) t.parlays++
    t.wins += results.filter((r) => r === 'win').length
    t.losses += results.filter((r) => r === 'loss').length
    t.pushes += results.filter((r) => r === 'push').length
  }

  return [...totals.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || a.displayName.localeCompare(b.displayName)
  )
}

export interface WeekPicksEntry {
  userId: number
  displayName: string
  gameId: number
  side: 'home' | 'away'
  lockedSpread: number
  result: PickResult
}

/**
 * Everyone's picks for a week — but a pick is only included once its game has kicked
 * off (server-side; the pre-kickoff count is all anyone else gets to see).
 */
export async function getVisibleWeekPicks(
  season: number,
  week: number
): Promise<{ visible: WeekPicksEntry[]; hiddenCountByGame: Map<number, number> }> {
  const rows = await db
    .select({
      userId: picks.userId,
      displayName: users.displayName,
      gameId: picks.gameId,
      side: picks.side,
      lockedSpread: picks.lockedSpread,
      result: picks.result,
      kickoff: games.kickoff,
    })
    .from(picks)
    .innerJoin(users, eq(users.id, picks.userId))
    .innerJoin(games, eq(games.id, picks.gameId))
    .where(and(eq(picks.season, season), eq(picks.week, week)))

  const now = new Date()
  const visible: WeekPicksEntry[] = []
  const hiddenCountByGame = new Map<number, number>()
  for (const r of rows) {
    if (r.kickoff <= now) {
      visible.push({
        userId: r.userId,
        displayName: r.displayName,
        gameId: r.gameId,
        side: r.side as 'home' | 'away',
        lockedSpread: r.lockedSpread,
        result: r.result as PickResult,
      })
    } else {
      hiddenCountByGame.set(r.gameId, (hiddenCountByGame.get(r.gameId) ?? 0) + 1)
    }
  }
  return { visible, hiddenCountByGame }
}
