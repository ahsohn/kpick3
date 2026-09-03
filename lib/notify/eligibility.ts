export interface ReminderGame {
  kickoff: Date
  statusState: string
  canceled: boolean
  homeTeamAbbr: string
  awayTeamAbbr: string
}

/** Games a pick can still be made on: not canceled, still 'pre', kickoff in the future. */
export function pickableGames<T extends ReminderGame>(games: T[], now: Date): T[] {
  return games.filter((g) => !g.canceled && g.statusState === 'pre' && g.kickoff > now)
}

/**
 * Pick3: remind anyone with fewer than 3 picks while pickable games remain. When
 * pickedGameIds is provided, a pickable game the player has already picked doesn't
 * count — one pick per game means it can't absorb another pick — so the reminder
 * only fires if at least one pickable game is still actually available to them.
 */
export function needsPick3Reminder<T extends ReminderGame & { id?: number }>(
  pickCount: number,
  games: T[],
  now: Date,
  pickedGameIds?: Set<number>
): boolean {
  if (pickCount >= 3) return false
  const pickable = pickableGames(games, now)
  if (!pickedGameIds) return pickable.length > 0
  return pickable.some((g) => g.id === undefined || !pickedGameIds.has(g.id))
}

export interface SurvivorReminderState {
  enrolled: boolean
  alive: boolean
  hasPickThisWeek: boolean
  usedTeams: Set<string>
}

/**
 * Survivor: enrolled, still alive, no live pick this week, and at least one pickable
 * game with a side they haven't burned (mirrors getSurvivorBannerStatus's rule).
 */
export function needsSurvivorReminder(
  s: SurvivorReminderState,
  games: ReminderGame[],
  now: Date
): boolean {
  if (!s.enrolled || !s.alive || s.hasPickThisWeek) return false
  return pickableGames(games, now).some(
    (g) => !s.usedTeams.has(g.homeTeamAbbr) || !s.usedTeams.has(g.awayTeamAbbr)
  )
}

export interface RecapGame {
  completed: boolean
  canceled: boolean
  gradedAt: Date | null
  needsReview: boolean
}

/**
 * A week is recap-ready once every game is graded (canceled games get gradedAt when
 * voided), nothing is flagged for review, and at least one game actually finished —
 * a flagged final therefore holds the recap until the admin confirms it.
 */
export function weekFullyGraded(games: RecapGame[]): boolean {
  if (games.length === 0) return false
  if (!games.some((g) => g.completed && !g.canceled)) return false
  return games.every((g) => g.gradedAt !== null && !g.needsReview)
}
