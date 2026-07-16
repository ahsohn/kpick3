export type PickResult = 'pending' | 'win' | 'loss' | 'push' | 'void'

/**
 * Grades one pick against the spread. `lockedSpread` is the points added to the picked
 * team's score (+3.5 = underdog, -3.5 = favorite), locked at submission time.
 */
export function gradePick(
  side: 'home' | 'away',
  lockedSpread: number,
  homeScore: number,
  awayScore: number
): Exclude<PickResult, 'pending' | 'void'> {
  const picked = side === 'home' ? homeScore : awayScore
  const other = side === 'home' ? awayScore : homeScore
  const adjusted = picked + lockedSpread
  if (adjusted > other) return 'win'
  if (adjusted < other) return 'loss'
  return 'push'
}

/**
 * Points for one user-week. 1 per win; +1 parlay bonus only for a perfect 3-for-3.
 * A push or void scores 0 and (since it isn't a win) kills the parlay.
 */
export function weeklyPoints(results: PickResult[]): { points: number; parlay: boolean } {
  const wins = results.filter((r) => r === 'win').length
  const parlay = wins === 3
  return { points: wins + (parlay ? 1 : 0), parlay }
}
