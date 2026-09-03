import { etParts } from '@/lib/picks/line-lock'

export type ReminderWindow = 'sat' | 'sun'

const REMINDER_HOUR_ET = 9

/**
 * Which reminder window `now` falls in: Saturday or Sunday, 9 AM ET to midnight ET.
 * The window is deliberately wide — the hourly cron's first tick past 9 sends, and
 * the dedupe key makes every later tick a no-op, so a missed tick self-heals all day.
 */
export function reminderWindow(now: Date): ReminderWindow | null {
  const p = etParts(now)
  if (p.hour < REMINDER_HOUR_ET) return null
  if (p.weekday === 'Sat') return 'sat'
  if (p.weekday === 'Sun') return 'sun'
  return null
}
