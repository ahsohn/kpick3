import { describe, expect, it } from 'vitest'
import { liveCover } from '@/lib/picks/live-cover'

describe('liveCover', () => {
  it('reports covering when the pick is ahead of the number', () => {
    expect(liveCover('home', -3.5, 24, 17)).toBe('covering')
    expect(liveCover('away', 3.5, 20, 17)).toBe('covering')
  })
  it('reports trailing when the pick is behind the number', () => {
    expect(liveCover('home', -3.5, 20, 17)).toBe('trailing')
  })
  it('reports on-number when the score lands exactly on a whole spread', () => {
    expect(liveCover('home', -3, 20, 17)).toBe('on-number')
  })
  it('returns null without a score', () => {
    expect(liveCover('home', -3, null, 17)).toBeNull()
    expect(liveCover('home', -3, 20, null)).toBeNull()
  })
})
