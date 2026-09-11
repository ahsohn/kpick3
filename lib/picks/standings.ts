import { weeklyPoints, type PickResult } from './grading'

export interface Totals {
  points: number
  wins: number
  losses: number
  pushes: number
  parlays: number
}

export interface WeekTotals extends Totals {
  /** Every pick that week has a result (no pendings left). */
  graded: boolean
  picks: number
}

export interface PlayerStandings {
  userId: number
  displayName: string
  season: Totals
  weeks: Map<number, WeekTotals>
}

export interface StandingsPickRow {
  userId: number
  displayName: string
  week: number
  result: PickResult
}

function emptyTotals(): Totals {
  return { points: 0, wins: 0, losses: 0, pushes: 0, parlays: 0 }
}

export function totalsFromResults(results: PickResult[]): WeekTotals {
  const { points, parlay } = weeklyPoints(results)
  return {
    points,
    parlays: parlay ? 1 : 0,
    wins: results.filter((r) => r === 'win').length,
    losses: results.filter((r) => r === 'loss').length,
    pushes: results.filter((r) => r === 'push').length,
    graded: results.every((r) => r !== 'pending'),
    picks: results.length,
  }
}

/** Season-total order: points, then wins, then name. */
export function compareTotals(a: Totals, b: Totals): number {
  return b.points - a.points || b.wins - a.wins
}

/**
 * Folds every pick of a season into per-player season totals and per-week totals.
 * Pure: nothing stored that can drift stale.
 */
export function aggregateStandings(rows: StandingsPickRow[]): PlayerStandings[] {
  const byUserWeek = new Map<number, Map<number, PickResult[]>>()
  const names = new Map<number, string>()
  for (const r of rows) {
    names.set(r.userId, r.displayName)
    if (!byUserWeek.has(r.userId)) byUserWeek.set(r.userId, new Map())
    const weeks = byUserWeek.get(r.userId)!
    if (!weeks.has(r.week)) weeks.set(r.week, [])
    weeks.get(r.week)!.push(r.result)
  }

  const players: PlayerStandings[] = []
  for (const [userId, weekMap] of byUserWeek) {
    const season = emptyTotals()
    const weeks = new Map<number, WeekTotals>()
    for (const [week, results] of weekMap) {
      const t = totalsFromResults(results)
      weeks.set(week, t)
      season.points += t.points
      season.wins += t.wins
      season.losses += t.losses
      season.pushes += t.pushes
      season.parlays += t.parlays
    }
    players.push({ userId, displayName: names.get(userId)!, season, weeks })
  }
  return players.sort(
    (a, b) => compareTotals(a.season, b.season) || a.displayName.localeCompare(b.displayName)
  )
}

/** The same players re-ranked by one week's totals (players without picks that week sink to the bottom). */
export function rankByWeek(players: PlayerStandings[], week: number): PlayerStandings[] {
  const none = emptyTotals()
  return [...players].sort((a, b) => {
    const ta = a.weeks.get(week)
    const tb = b.weeks.get(week)
    if (!ta !== !tb) return ta ? -1 : 1
    return compareTotals(ta ?? none, tb ?? none) || a.displayName.localeCompare(b.displayName)
  })
}
