export interface RevealedPick {
  userId: number
  displayName: string
  gameId: number
  side: 'home' | 'away'
}

export interface PairPlayer {
  userId: number
  displayName: string
  /** Revealed picks this player has made (context for the shared count). */
  picks: number
}

export interface PickPair {
  a: PairPlayer
  b: PairPlayer
  /** Games where both took the same side. */
  shared: number
}

/**
 * Every pair of players with at least one revealed pick in common, most in common
 * first (ties broken alphabetically). "In common" means the same side of the same game.
 */
export function commonPickPairs(picks: RevealedPick[]): PickPair[] {
  const players = new Map<number, PairPlayer>()
  const bySelection = new Map<string, number[]>()
  for (const p of picks) {
    const player = players.get(p.userId) ?? { userId: p.userId, displayName: p.displayName, picks: 0 }
    player.picks += 1
    players.set(p.userId, player)
    const key = `${p.gameId}:${p.side}`
    if (!bySelection.has(key)) bySelection.set(key, [])
    bySelection.get(key)!.push(p.userId)
  }

  const shared = new Map<string, number>()
  for (const ids of bySelection.values()) {
    const sorted = [...new Set(ids)].sort((x, y) => x - y)
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}:${sorted[j]}`
        shared.set(key, (shared.get(key) ?? 0) + 1)
      }
    }
  }

  const pairs: PickPair[] = [...shared.entries()].map(([key, n]) => {
    const [x, y] = key.split(':').map(Number)
    const [a, b] = [players.get(x)!, players.get(y)!].sort((p, q) =>
      p.displayName.localeCompare(q.displayName)
    )
    return { a, b, shared: n }
  })
  return pairs.sort(
    (p, q) =>
      q.shared - p.shared ||
      p.a.displayName.localeCompare(q.a.displayName) ||
      p.b.displayName.localeCompare(q.b.displayName)
  )
}
