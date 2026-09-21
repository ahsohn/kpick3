import type { PickResult } from './grading'

/** The locked line is signed for the picked side: negative lays points, positive takes them. */
export interface SpreadPick {
  userId: number
  displayName: string
  lockedSpread: number
  result: PickResult
}

interface Record_ {
  picks: number
  wins: number
}

export interface FavDogRow {
  userId: number
  displayName: string
  favorites: Record_
  dogs: Record_
  /** Lines of exactly 0 — neither a favorite nor a dog. */
  pickems: number
}

/**
 * How often each player lays points versus takes them, and how each habit has gone.
 * Ranked from the biggest chalk bettor to the biggest dog lover, then by name.
 */
export function favoritesAndDogs(picks: SpreadPick[]): FavDogRow[] {
  const byPlayer = new Map<number, FavDogRow>()
  for (const p of picks) {
    const row =
      byPlayer.get(p.userId) ??
      {
        userId: p.userId,
        displayName: p.displayName,
        favorites: { picks: 0, wins: 0 },
        dogs: { picks: 0, wins: 0 },
        pickems: 0,
      }
    if (p.lockedSpread === 0) {
      row.pickems += 1
    } else {
      const bucket = p.lockedSpread < 0 ? row.favorites : row.dogs
      bucket.picks += 1
      if (p.result === 'win') bucket.wins += 1
    }
    byPlayer.set(p.userId, row)
  }
  const favShare = (r: FavDogRow) => {
    const sided = r.favorites.picks + r.dogs.picks
    return sided === 0 ? 0 : r.favorites.picks / sided
  }
  return [...byPlayer.values()].sort(
    (a, b) => favShare(b) - favShare(a) || a.displayName.localeCompare(b.displayName)
  )
}

export interface SpreadTotalRow {
  userId: number
  displayName: string
  /** Sum of |locked line| across every revealed pick. */
  total: number
  picks: number
  average: number
}

/** Total points laid or taken per player, biggest number-chasers first. */
export function spreadTotals(picks: SpreadPick[]): SpreadTotalRow[] {
  const byPlayer = new Map<number, SpreadTotalRow>()
  for (const p of picks) {
    const row =
      byPlayer.get(p.userId) ?? { userId: p.userId, displayName: p.displayName, total: 0, picks: 0, average: 0 }
    row.total += Math.abs(p.lockedSpread)
    row.picks += 1
    byPlayer.set(p.userId, row)
  }
  return [...byPlayer.values()]
    .map((r) => ({ ...r, average: r.total / r.picks }))
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName))
}

/** A pick plus its game's score, for measuring how far it beat or missed the number. */
export interface MarginPick {
  userId: number
  displayName: string
  side: 'home' | 'away'
  lockedSpread: number
  result: PickResult
  homeScore: number | null
  awayScore: number | null
}

export interface CoverMarginRow {
  userId: number
  displayName: string
  /** Net points against the number across every graded pick: +3 for covering by 3,
   *  -3 for missing by 3. Pushes add 0. */
  total: number
  /** Graded picks counted (wins, losses and pushes). */
  picks: number
  average: number
  /** Biggest single cover (never below 0). */
  best: number
  /** Worst single miss (never above 0). */
  worst: number
}

/**
 * How far each pick beat or missed its locked line, summed per player. A -3 favorite
 * that wins by 6 covers by 3 (+3); the same team winning by 1 misses by 2 (-2).
 * Pending and voided picks are skipped, as is any pick without a final score.
 * Ranked from the biggest net cover down, then by name.
 */
export function coverMargins(picks: MarginPick[]): CoverMarginRow[] {
  const byPlayer = new Map<number, CoverMarginRow>()
  for (const p of picks) {
    if (p.result === 'pending' || p.result === 'void') continue
    if (p.homeScore === null || p.awayScore === null) continue
    const picked = p.side === 'home' ? p.homeScore : p.awayScore
    const other = p.side === 'home' ? p.awayScore : p.homeScore
    const margin = picked + p.lockedSpread - other
    const row =
      byPlayer.get(p.userId) ??
      { userId: p.userId, displayName: p.displayName, total: 0, picks: 0, average: 0, best: 0, worst: 0 }
    row.total += margin
    row.picks += 1
    row.best = Math.max(row.best, margin)
    row.worst = Math.min(row.worst, margin)
    byPlayer.set(p.userId, row)
  }
  return [...byPlayer.values()]
    .map((r) => ({ ...r, average: r.total / r.picks }))
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName))
}
