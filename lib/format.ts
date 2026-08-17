/** Kickoff in US Eastern, e.g. "Sun, Sep 7 · 1:00 PM ET". */
export function formatKickoff(d: Date): string {
  const day = d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const time = d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${day} · ${time} ET`
}

/** Kickoff day for the status column, e.g. "SUN". */
export function formatKickoffDay(d: Date): string {
  return d
    .toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
    .toUpperCase()
}

/** Kickoff time for the status column, e.g. "4:25 PM". */
export function formatKickoffTime(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Spread for display: "+3.5", "-7", or "PK" for a pick'em. */
export function formatSpread(spread: number | null): string {
  if (spread === null) return '—'
  if (spread === 0) return 'PK'
  return spread > 0 ? `+${trim(spread)}` : `${trim(spread)}`
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Rough age for the admin sync banner: "48m", "3h 20m", "2d 4h". */
export function formatAgo(d: Date, now: Date = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return mins % 60 ? `${hours}h ${mins % 60}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`
}

/** The picked team's spread given the game's home-relative spread. */
export function spreadForSide(homeSpread: number, side: 'home' | 'away'): number {
  return side === 'home' ? homeSpread : -homeSpread
}
