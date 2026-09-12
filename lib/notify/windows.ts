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

/**
 * The ET calendar date (YYYY-MM-DD) for reminder dedupe keys. Keying on the date
 * instead of just the window name matters when one week number spans two weekends
 * (the week rolls forward before its first kickoff): a Saturday reminder sent last
 * weekend must not suppress this Saturday's.
 */
export function reminderDateKey(now: Date): string {
  const p = etParts(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}
