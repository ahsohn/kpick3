import { describe, expect, it } from 'vitest'
import { formatAgo } from '@/lib/format'

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
