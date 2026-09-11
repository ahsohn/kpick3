import { describe, expect, it } from 'vitest'
import { aggregateStandings, rankByWeek, type StandingsPickRow } from '@/lib/picks/standings'

const row = (userId: number, week: number, result: StandingsPickRow['result']): StandingsPickRow => ({
  userId,
  displayName: `P${userId}`,
  week,
  result,
})

describe('aggregateStandings', () => {
  it('sums season points and per-week totals, with the parlay bonus', () => {
    const players = aggregateStandings([
      row(1, 1, 'win'), row(1, 1, 'win'), row(1, 1, 'win'),
      row(1, 2, 'win'), row(1, 2, 'loss'), row(1, 2, 'push'),
      row(2, 1, 'loss'), row(2, 1, 'loss'), row(2, 1, 'win'),
    ])
    expect(players.map((p) => p.userId)).toEqual([1, 2])
    expect(players[0].season).toEqual({ points: 5, wins: 4, losses: 1, pushes: 1, parlays: 1 })
    expect(players[0].weeks.get(1)).toMatchObject({ points: 4, parlays: 1, graded: true, picks: 3 })
    expect(players[0].weeks.get(2)).toMatchObject({ points: 1, parlays: 0, graded: true })
    expect(players[1].season.points).toBe(1)
  })
  it('flags a week with pending picks as not graded', () => {
    const [p] = aggregateStandings([row(1, 3, 'win'), row(1, 3, 'pending')])
    expect(p.weeks.get(3)).toMatchObject({ points: 1, graded: false })
  })
  it('breaks a points tie on wins, then name', () => {
    const players = aggregateStandings([
      row(2, 1, 'win'), row(2, 1, 'push'),
      row(1, 1, 'win'), row(1, 1, 'loss'),
    ])
    // Same points and wins → alphabetical.
    expect(players.map((p) => p.userId)).toEqual([1, 2])
  })
})

describe('rankByWeek', () => {
  it('orders by that week and sinks players with no picks', () => {
    const players = aggregateStandings([
      row(1, 1, 'win'), row(1, 1, 'win'), row(1, 1, 'win'),
      row(2, 1, 'loss'), row(2, 2, 'win'), row(2, 2, 'win'),
      row(3, 1, 'win'), row(3, 1, 'win'),
    ])
    expect(players.map((p) => p.userId)).toEqual([1, 2, 3])
    expect(rankByWeek(players, 2).map((p) => p.userId)).toEqual([2, 1, 3])
  })
})
