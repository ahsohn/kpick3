const ET = 'America/New_York'
const LOCK_HOUR_ET = 13 // 1:00 PM

interface EtParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  weekday: string
}

/** The instant's wall-clock reading in US Eastern. */
function etParts(d: Date): EtParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24, // hour12:false renders midnight as "24"
    minute: Number(get('minute')),
    weekday: get('weekday'), // 'Sun' | 'Mon' | ...
  }
}

/**
 * The UTC instant of an ET wall-clock time. day may be un-normalized (0, -1, …) —
 * Date.UTC rolls it over. Guess EST first, then correct by how far off the guess
 * renders in ET — converges in one step and handles DST on either side.
 */
function etWallTimeToUtc(year: number, month: number, day: number, hour: number): Date {
  let ts = Date.UTC(year, month - 1, day, hour + 5)
  for (let i = 0; i < 2; i++) {
    const p = etParts(new Date(ts))
    const got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    ts += Date.UTC(year, month - 1, day, hour) - got
  }
  return new Date(ts)
}

/**
 * When a game's line locks: Sun/Mon kickoffs (in ET) lock the Saturday before at
 * 1 PM ET; any other day locks at 1 PM ET the day before the game.
 */
export function lineLockTime(kickoff: Date): Date {
  const k = etParts(kickoff)
  const daysBack = k.weekday === 'Mon' ? 2 : 1
  return etWallTimeToUtc(k.year, k.month, k.day - daysBack, LOCK_HOUR_ET)
}

export function isLineLocked(kickoff: Date, now: Date = new Date()): boolean {
  return now >= lineLockTime(kickoff)
}
