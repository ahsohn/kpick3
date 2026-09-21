import { describe, expect, it } from 'vitest'
import { favoriteTeams, type TeamPick } from '@/lib/picks/favorite-teams'

const pick = (userId: number, teamAbbr: string): TeamPick => ({
  userId,
  displayName: `P${userId}`,
  teamAbbr,
  teamLogo: `${teamAbbr}.png`,
})

describe('favoriteTeams', () => {
  it("ranks each player's most-picked team by count", () => {
    const rows = favoriteTeams([
      pick(1, 'KC'), pick(1, 'KC'), pick(1, 'BUF'),
      pick(2, 'DAL'), pick(2, 'DAL'), pick(2, 'DAL'),
      pick(3, 'NYJ'),
    ])
    expect(rows.map((r) => [r.displayName, r.teams.map((t) => t.abbr), r.count])).toEqual([
      ['P2', ['DAL'], 3],
      ['P1', ['KC'], 2],
    ])
    expect(rows[0].teams[0].logo).toBe('DAL.png')
  })
  it('lists every team tied for a player, and breaks player ties by name', () => {
    const rows = favoriteTeams([
      pick(2, 'SF'), pick(2, 'SF'), pick(2, 'SEA'), pick(2, 'SEA'),
      pick(1, 'GB'), pick(1, 'GB'),
    ])
    expect(rows.map((r) => r.displayName)).toEqual(['P1', 'P2'])
    expect(rows[1].teams.map((t) => t.abbr)).toEqual(['SEA', 'SF'])
  })
  it('drops players whose top team was picked fewer than minCount times', () => {
    const picks = [pick(1, 'KC'), pick(1, 'BUF'), pick(2, 'DAL'), pick(2, 'DAL')]
    expect(favoriteTeams(picks).map((r) => r.displayName)).toEqual(['P2'])
    expect(favoriteTeams(picks, 1).map((r) => r.displayName)).toEqual(['P2', 'P1'])
  })
  it('handles no picks', () => {
    expect(favoriteTeams([])).toEqual([])
  })
})
