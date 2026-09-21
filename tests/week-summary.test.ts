import { describe, expect, it } from 'vitest'
import { summarizeWeek, formatDollars, STAKE, WIN_PAYOUT } from '@/lib/picks/week-summary'

describe('summarizeWeek', () => {
  it('counts wins, losses, pushes and pending; voids are ignored', () => {
    const s = summarizeWeek(['win', 'win', 'loss', 'push', 'pending', 'void'])
    expect(s).toMatchObject({ wins: 2, losses: 1, pushes: 1, pending: 1, graded: 4 })
  })
  it('pays -110 juice on wins and loses the stake on losses; pushes are flat', () => {
    expect(summarizeWeek(['win']).dollars).toBeCloseTo(WIN_PAYOUT, 5)
    expect(summarizeWeek(['loss']).dollars).toBe(-STAKE)
    expect(summarizeWeek(['push', 'void', 'pending']).dollars).toBe(0)
    expect(summarizeWeek(['win', 'win', 'loss']).dollars).toBeCloseTo(2 * WIN_PAYOUT - STAKE, 5)
  })
  it('an empty week is all zeros', () => {
    expect(summarizeWeek([])).toEqual({ wins: 0, losses: 0, pushes: 0, pending: 0, graded: 0, dollars: 0 })
  })
})

describe('formatDollars', () => {
  it('signs and rounds to whole dollars', () => {
    expect(formatDollars(372.727)).toBe('+$373')
    expect(formatDollars(-1200)).toBe('-$1,200')
    expect(formatDollars(0)).toBe('$0')
    expect(formatDollars(-0.4)).toBe('$0')
  })
})
