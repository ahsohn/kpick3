import { describe, expect, it } from 'vitest'
import { isLineLocked, lineLockTime } from '@/lib/picks/line-lock'

// 2026 season reference points (EDT = UTC-4, EST = UTC-5):
// Week 1: Thu Sep 10, Sun Sep 13, Mon Sep 14. DST ends Sun Nov 1 2026 (ET).
describe('lineLockTime', () => {
  it('locks a Sunday 1 PM game the Saturday before at 1 PM ET', () => {
    // Sun Sep 13 2026 1:00 PM EDT = 17:00Z → Sat Sep 12 1:00 PM EDT = 17:00Z
    expect(lineLockTime(new Date('2026-09-13T17:00:00Z')).toISOString())
      .toBe('2026-09-12T17:00:00.000Z')
  })
  it('locks Monday Night Football the Saturday before, using the ET day (kickoff is Tuesday UTC)', () => {
    // Mon Sep 14 2026 8:15 PM EDT = Tue Sep 15 00:15Z. A UTC-day bug would give Mon 1 PM.
    expect(lineLockTime(new Date('2026-09-15T00:15:00Z')).toISOString())
      .toBe('2026-09-12T17:00:00.000Z')
  })
  it('locks Sunday Night Football the Saturday before (kickoff is Monday UTC)', () => {
    // Sun Sep 13 2026 8:20 PM EDT = Mon Sep 14 00:20Z.
    expect(lineLockTime(new Date('2026-09-14T00:20:00Z')).toISOString())
      .toBe('2026-09-12T17:00:00.000Z')
  })
  it('locks a Thursday game on Wednesday 1 PM ET', () => {
    // Thu Sep 10 2026 8:20 PM EDT = Fri Sep 11 00:20Z → Wed Sep 9 1 PM EDT.
    expect(lineLockTime(new Date('2026-09-11T00:20:00Z')).toISOString())
      .toBe('2026-09-09T17:00:00.000Z')
  })
  it('locks a Saturday game on Friday 1 PM ET (EST in December)', () => {
    // Sat Dec 19 2026 1:00 PM EST = 18:00Z → Fri Dec 18 1 PM EST = 18:00Z.
    expect(lineLockTime(new Date('2026-12-19T18:00:00Z')).toISOString())
      .toBe('2026-12-18T18:00:00.000Z')
  })
  it('handles the DST fall-back boundary (game EST, lock still EDT)', () => {
    // Sun Nov 1 2026 1:00 PM EST = 18:00Z; lock Sat Oct 31 1 PM EDT = 17:00Z.
    expect(lineLockTime(new Date('2026-11-01T18:00:00Z')).toISOString())
      .toBe('2026-10-31T17:00:00.000Z')
  })
})

describe('isLineLocked', () => {
  const kickoff = new Date('2026-09-13T17:00:00Z') // locks 2026-09-12T17:00:00Z
  it('is unlocked before the lock time', () => {
    expect(isLineLocked(kickoff, new Date('2026-09-12T16:59:59Z'))).toBe(false)
  })
  it('is locked exactly at the lock time', () => {
    expect(isLineLocked(kickoff, new Date('2026-09-12T17:00:00Z'))).toBe(true)
  })
  it('is locked after the lock time', () => {
    expect(isLineLocked(kickoff, new Date('2026-09-13T00:00:00Z'))).toBe(true)
  })
})
