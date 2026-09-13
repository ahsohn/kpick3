import { describe, expect, it } from 'vitest'
import { formatAgo, formatLastSeen } from '@/lib/format'

describe('formatAgo', () => {
  const now = new Date('2026-09-13T12:00:00Z')
  it('renders minutes under an hour', () => {
    expect(formatAgo(new Date('2026-09-13T11:12:00Z'), now)).toBe('48m')
  })
  it('renders hours and minutes', () => {
    expect(formatAgo(new Date('2026-09-13T08:40:00Z'), now)).toBe('3h 20m')
  })
  it('renders whole hours without minutes', () => {
    expect(formatAgo(new Date('2026-09-13T09:00:00Z'), now)).toBe('3h')
  })
  it('renders days and hours', () => {
    expect(formatAgo(new Date('2026-09-11T08:00:00Z'), now)).toBe('2d 4h')
  })
  it('clamps future dates to 0m', () => {
    expect(formatAgo(new Date('2026-09-13T12:05:00Z'), now)).toBe('0m')
  })
})

describe('formatLastSeen', () => {
  it('prefixes the ET timestamp with how long ago', () => {
    const now = new Date('2026-09-13T12:00:00Z')
    expect(formatLastSeen(new Date('2026-09-13T08:40:00Z'), now)).toBe('(3h 20m ago) Sun, Sep 13 · 4:40 AM ET')
  })
})
