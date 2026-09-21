import { describe, expect, it } from 'vitest'
import { commonPickPairs, type RevealedPick } from '@/lib/picks/pairs'

const pick = (userId: number, gameId: number, side: 'home' | 'away'): RevealedPick => ({
  userId,
  displayName: `P${userId}`,
  gameId,
  side,
})

describe('commonPickPairs', () => {
  it('counts games where both players took the same side', () => {
    const pairs = commonPickPairs([
      pick(1, 10, 'home'), pick(2, 10, 'home'), pick(3, 10, 'away'),
      pick(1, 11, 'away'), pick(2, 11, 'away'), pick(3, 11, 'away'),
      pick(1, 12, 'home'), pick(3, 12, 'home'),
    ])
    expect(pairs.map((p) => [p.a.displayName, p.b.displayName, p.shared])).toEqual([
      ['P1', 'P2', 2],
      ['P1', 'P3', 2],
      ['P2', 'P3', 1],
    ])
    expect(pairs[0].a.picks).toBe(3)
    expect(pairs[0].b.picks).toBe(2)
  })
  it('sorts by shared count, then by names', () => {
    const pairs = commonPickPairs([
      pick(1, 10, 'home'), pick(2, 10, 'home'),
      pick(3, 11, 'home'), pick(4, 11, 'home'), pick(3, 12, 'away'), pick(4, 12, 'away'),
    ])
    expect(pairs.slice(0, 2).map((p) => `${p.a.displayName}+${p.b.displayName}`)).toEqual(['P3+P4', 'P1+P2'])
  })
  it('omits pairs with nothing in common and handles no picks', () => {
    expect(commonPickPairs([])).toEqual([])
    expect(commonPickPairs([pick(1, 10, 'home'), pick(2, 10, 'away')])).toEqual([])
  })
})
