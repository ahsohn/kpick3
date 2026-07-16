import { getCurrentSeason, getCurrentWeek, getWeeksWithGames } from './queries'

export interface WeekContext {
  season: number
  week: number
  currentWeek: number
  weeks: number[]
}

/**
 * Resolves the season + requested week for a page. Returns null before the first sync
 * has ever run (no games in the DB at all).
 */
export async function resolveWeek(weekParam?: string): Promise<WeekContext | null> {
  const season = await getCurrentSeason()
  if (season === null) return null
  const currentWeek = await getCurrentWeek(season)
  const weeks = await getWeeksWithGames(season)
  const requested = weekParam ? parseInt(weekParam, 10) : NaN
  const week = Number.isFinite(requested) && weeks.includes(requested) ? requested : currentWeek
  return { season, week, currentWeek, weeks }
}
