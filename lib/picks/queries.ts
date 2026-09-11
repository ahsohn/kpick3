import { db } from '@/lib/db'
import { games, picks, users, type Game, type Pick } from '@/lib/db/schema'
import { and, asc, desc, eq, max } from 'drizzle-orm'
import type { PickResult } from './grading'
import { aggregateStandings, type PlayerStandings, type StandingsPickRow } from './standings'

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

/** Time of the last successful sync pass (every pass re-stamps games.updated_at). */
export async function getLastSyncTime(): Promise<Date | null> {
  const rows = await db.select({ last: max(games.updatedAt) }).from(games)
  return rows[0]?.last ?? null
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

/** Every pick of the season with the name attached — the raw input for standings. */
export async function getStandingsRows(season: number): Promise<StandingsPickRow[]> {
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
  return rows.map((r) => ({ ...r, result: r.result as PickResult }))
}

/** Season + per-week standings, computed from graded picks (nothing stored to drift stale). */
export async function getPlayerStandings(season: number): Promise<PlayerStandings[]> {
  return aggregateStandings(await getStandingsRows(season))
}

/** Flat season standings (used by the weekly recap email). */
export async function getStandings(season: number): Promise<StandingsRow[]> {
  return (await getPlayerStandings(season)).map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    ...p.season,
  }))
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
