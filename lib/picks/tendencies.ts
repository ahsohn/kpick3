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
