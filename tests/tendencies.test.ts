import { describe, expect, it } from 'vitest'
import { favoritesAndDogs, spreadTotals, type SpreadPick } from '@/lib/picks/tendencies'

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
