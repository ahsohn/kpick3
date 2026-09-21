export interface TeamPick {
  userId: number
  displayName: string
  teamAbbr: string
  teamLogo: string
}

export interface FavoriteTeamRow {
  userId: number
  displayName: string
  /** The player's most-picked team(s) — several if tied, alphabetical. */
  teams: { abbr: string; logo: string }[]
  count: number
}

/** A team picked (or faded) only once says nothing about loyalty. */
export const MIN_TEAM_COUNT = 2

/**
 * Each player's most-picked team, players ranked by that count (ties by name). Players
 * whose top count is below `minCount` are left out. Feed it opponent teams instead to
 * get "picked against" the same way.
 */
export function favoriteTeams(picks: TeamPick[], minCount = MIN_TEAM_COUNT): FavoriteTeamRow[] {
  const byPlayer = new Map<number, { displayName: string; teams: Map<string, { logo: string; n: number }> }>()
  for (const p of picks) {
    const player = byPlayer.get(p.userId) ?? { displayName: p.displayName, teams: new Map() }
    const team = player.teams.get(p.teamAbbr) ?? { logo: p.teamLogo, n: 0 }
    team.n += 1
    player.teams.set(p.teamAbbr, team)
    byPlayer.set(p.userId, player)
  }

  const rows: FavoriteTeamRow[] = [...byPlayer.entries()].map(([userId, player]) => {
    const count = Math.max(...[...player.teams.values()].map((t) => t.n))
    const teams = [...player.teams.entries()]
      .filter(([, t]) => t.n === count)
      .map(([abbr, t]) => ({ abbr, logo: t.logo }))
      .sort((a, b) => a.abbr.localeCompare(b.abbr))
    return { userId, displayName: player.displayName, teams, count }
  })
  return rows
    .filter((r) => r.count >= minCount)
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName))
}
