import { describe, expect, it } from 'vitest'
import { reminderDateKey, reminderWindow } from '../lib/notify/windows'

describe('reminderWindow', () => {
  it('is null before 9 AM ET on Saturday', () => {
    // 2026-09-12 12:55 UTC = 8:55 AM EDT
    expect(reminderWindow(new Date('2026-09-12T12:55:00Z'))).toBeNull()
  })

  it('opens the sat window from 9 AM ET Saturday', () => {
    // 2026-09-12 13:55 UTC = 9:55 AM EDT — the first hourly cron tick past 9
    expect(reminderWindow(new Date('2026-09-12T13:55:00Z'))).toBe('sat')
  })

  it('stays open through Saturday evening ET', () => {
    // 2026-09-13 02:55 UTC = Sat 10:55 PM EDT
    expect(reminderWindow(new Date('2026-09-13T02:55:00Z'))).toBe('sat')
  })

  it('opens the sun window from 9 AM ET Sunday', () => {
    expect(reminderWindow(new Date('2026-09-13T13:55:00Z'))).toBe('sun')
  })

  it('is null on a weekday', () => {
    // 2026-09-10 is a Thursday
    expect(reminderWindow(new Date('2026-09-10T15:00:00Z'))).toBeNull()
  })

  it('respects EST in winter', () => {
    // 2026-12-20 (Sunday): 13:55 UTC = 8:55 AM EST → closed; 14:55 UTC = 9:55 AM EST → open
    expect(reminderWindow(new Date('2026-12-20T13:55:00Z'))).toBeNull()
    expect(reminderWindow(new Date('2026-12-20T14:55:00Z'))).toBe('sun')
  })
})

describe('reminderDateKey', () => {
  it('uses the ET calendar date, so late Saturday UTC is still Saturday', () => {
    // 02:55 UTC Sunday is 10:55 PM ET Saturday.
    expect(reminderDateKey(new Date('2026-09-13T02:55:00Z'))).toBe('2026-09-12')
  })

  it('gives consecutive Saturdays different keys even within the same week number', () => {
    expect(reminderDateKey(new Date('2026-09-05T13:55:00Z'))).not.toBe(
      reminderDateKey(new Date('2026-09-12T13:55:00Z'))
    )
  })
})
