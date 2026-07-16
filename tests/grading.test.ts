import { describe, expect, it } from 'vitest'
import { gradePick, weeklyPoints } from '@/lib/picks/grading'

describe('gradePick', () => {
  // Home favored by 3.5, final 27–20 home: home covers, away doesn't.
  it('grades a covering favorite as a win', () => {
    expect(gradePick('home', -3.5, 27, 20)).toBe('win')
  })
  it('grades the other side of the same game as a loss', () => {
    expect(gradePick('away', 3.5, 27, 20)).toBe('loss')
  })
  it('grades an underdog that loses outright but covers as a win', () => {
    // Away +7.5, loses 20–24: 20 + 7.5 = 27.5 > 24 → covers.
    expect(gradePick('away', 7.5, 24, 20)).toBe('win')
  })
  it('grades a favorite that wins but fails to cover as a loss', () => {
    expect(gradePick('home', -7.5, 24, 20)).toBe('loss')
  })
  it('grades an exact landing on a whole-number spread as a push', () => {
    // Home -3, final 23–20.
    expect(gradePick('home', -3, 23, 20)).toBe('push')
    expect(gradePick('away', 3, 23, 20)).toBe('push')
  })
  it('handles a pick-em (spread 0)', () => {
    expect(gradePick('home', 0, 21, 20)).toBe('win')
    expect(gradePick('home', 0, 20, 20)).toBe('push')
    expect(gradePick('away', 0, 21, 20)).toBe('loss')
  })
})

describe('weeklyPoints', () => {
  it('scores 1 point per win', () => {
    expect(weeklyPoints(['win', 'loss', 'loss'])).toEqual({ points: 1, parlay: false })
    expect(weeklyPoints(['win', 'win', 'loss'])).toEqual({ points: 2, parlay: false })
  })
  it('awards the parlay bonus only for 3-for-3', () => {
    expect(weeklyPoints(['win', 'win', 'win'])).toEqual({ points: 4, parlay: true })
  })
  it('a push scores 0 and kills the parlay', () => {
    expect(weeklyPoints(['win', 'win', 'push'])).toEqual({ points: 2, parlay: false })
  })
  it('a void scores 0 and kills the parlay', () => {
    expect(weeklyPoints(['win', 'win', 'void'])).toEqual({ points: 2, parlay: false })
  })
  it('fewer than 3 picks can never parlay', () => {
    expect(weeklyPoints(['win', 'win'])).toEqual({ points: 2, parlay: false })
    expect(weeklyPoints([])).toEqual({ points: 0, parlay: false })
  })
  it('pending picks score nothing yet', () => {
    expect(weeklyPoints(['win', 'pending', 'pending'])).toEqual({ points: 1, parlay: false })
  })
})
