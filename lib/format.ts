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

/** The picked team's spread given the game's home-relative spread. */
export function spreadForSide(homeSpread: number, side: 'home' | 'away'): number {
  return side === 'home' ? homeSpread : -homeSpread
}
