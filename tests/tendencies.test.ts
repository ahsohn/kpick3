import { describe, expect, it } from 'vitest'
import { coverMargins, favoritesAndDogs, spreadTotals, type MarginPick, type SpreadPick } from '@/lib/picks/tendencies'

const pick = (userId: number, lockedSpread: number, result: SpreadPick['result'] = 'win'): SpreadPick => ({
  userId,
  displayName: `P${userId}`,
  lockedSpread,
  result,
})

describe('favoritesAndDogs', () => {
  it('splits picks by laying or taking points, with a record for each', () => {
    const rows = favoritesAndDogs([
      pick(1, -3, 'win'), pick(1, -7.5, 'loss'), pick(1, 2.5, 'win'), pick(1, 0, 'push'),
      pick(2, 6, 'loss'), pick(2, 3, 'loss'), pick(2, 1, 'pending'),
    ])
    expect(rows).toEqual([
      { userId: 1, displayName: 'P1', favorites: { picks: 2, wins: 1 }, dogs: { picks: 1, wins: 1 }, pickems: 1 },
      { userId: 2, displayName: 'P2', favorites: { picks: 0, wins: 0 }, dogs: { picks: 3, wins: 0 }, pickems: 0 },
    ])
  })
  it('sorts by share of picks on favorites, most chalk first, then name', () => {
    const rows = favoritesAndDogs([
      pick(1, -3), pick(1, 3),
      pick(2, -3), pick(2, -3), pick(2, 3),
      pick(3, 3),
    ])
    expect(rows.map((r) => r.displayName)).toEqual(['P2', 'P1', 'P3'])
  })
  it('handles no picks', () => {
    expect(favoritesAndDogs([])).toEqual([])
  })
})

describe('spreadTotals', () => {
  it('sums the absolute value of every locked line per player, biggest total first', () => {
    const rows = spreadTotals([
      pick(1, -3), pick(1, 7.5), pick(1, 0),
      pick(2, -13.5), pick(2, -10),
    ])
    expect(rows).toEqual([
      { userId: 2, displayName: 'P2', total: 23.5, picks: 2, average: 11.75 },
      { userId: 1, displayName: 'P1', total: 10.5, picks: 3, average: 3.5 },
    ])
  })
  it('breaks a total tie by name and handles no picks', () => {
    expect(spreadTotals([pick(2, 4), pick(1, -4)]).map((r) => r.displayName)).toEqual(['P1', 'P2'])
    expect(spreadTotals([])).toEqual([])
  })
})

describe('coverMargins', () => {
  const mp = (
    userId: number,
    side: 'home' | 'away',
    lockedSpread: number,
    homeScore: number | null,
    awayScore: number | null,
    result: MarginPick['result'] = 'win'
  ): MarginPick => ({ userId, displayName: `P${userId}`, side, lockedSpread, result, homeScore, awayScore })

  it('credits points beyond the number and debits points short of it', () => {
    const rows = coverMargins([
      // Home -3 wins 27-21: won by 6, covered by 3.
      mp(1, 'home', -3, 27, 21, 'win'),
      // Away +7 loses 30-20: lost by 10, missed by 3.
      mp(1, 'away', 7, 30, 20, 'loss'),
      // Away -3.5 wins 20-24: won by 4, covered by 0.5.
      mp(2, 'away', -3.5, 20, 24, 'win'),
      // Home +3 loses 17-20: exactly on the number, 0.
      mp(2, 'home', 3, 17, 20, 'push'),
    ])
    expect(rows).toEqual([
      { userId: 2, displayName: 'P2', total: 0.5, picks: 2, average: 0.25, best: 0.5, worst: 0 },
      { userId: 1, displayName: 'P1', total: 0, picks: 2, average: 0, best: 3, worst: -3 },
    ])
  })
  it('skips pending and voided picks and games without a final score', () => {
    const rows = coverMargins([
      mp(1, 'home', -3, 14, 0, 'pending'),
      mp(1, 'home', -3, 14, 0, 'void'),
      mp(1, 'home', -3, null, null, 'win'),
      mp(1, 'home', -3, 10, 0, 'win'),
    ])
    expect(rows).toEqual([{ userId: 1, displayName: 'P1', total: 7, picks: 1, average: 7, best: 7, worst: 0 }])
  })
  it('ranks the biggest net cover first, ties by name, and handles no picks', () => {
    const rows = coverMargins([
      mp(2, 'home', 0, 20, 10),
      mp(1, 'home', 0, 20, 10),
      mp(3, 'home', 0, 30, 10),
    ])
    expect(rows.map((r) => r.displayName)).toEqual(['P3', 'P1', 'P2'])
    expect(coverMargins([])).toEqual([])
  })
})
