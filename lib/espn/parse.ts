export interface ParsedGame {
  espnId: string
  season: number
  week: number
  kickoff: Date
  statusState: string          // 'pre' | 'in' | 'post'
  statusDetail: string | null
  completed: boolean
  canceled: boolean
  homeTeamName: string
  homeTeamAbbr: string
  homeTeamLogo: string
  awayTeamName: string
  awayTeamAbbr: string
  awayTeamLogo: string
  homeScore: number | null
  awayScore: number | null
  period: number | null
  displayClock: string | null
  homeSpread: number | null
  spreadDetails: string | null
}

const CANCELED_STATUSES = new Set(['STATUS_CANCELED', 'STATUS_FORFEIT'])

/**
 * Extracts the home-relative spread (negative = home favored) from an ESPN odds entry.
 * Prefers the numeric `spread` field; falls back to parsing `details` ("KC -3.5", "EVEN")
 * against the team abbreviations.
 */
export function parseHomeSpread(
  odds: any,
  homeAbbr: string,
  awayAbbr: string
): number | null {
  if (!odds) return null

  if (typeof odds.spread === 'number' && Number.isFinite(odds.spread)) {
    return odds.spread
  }

  const details: string | undefined = odds.details
  if (!details) return null
  if (/^even$/i.test(details.trim())) return 0

  const m = details.trim().match(/^([A-Za-z]+)\s*([-+]?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const [, abbr, valueStr] = m
  const value = parseFloat(valueStr)
  if (!Number.isFinite(value)) return null

  if (abbr.toUpperCase() === homeAbbr.toUpperCase()) return value
  if (abbr.toUpperCase() === awayAbbr.toUpperCase()) return -value
  return null
}

export function parseEvent(event: any): ParsedGame {
  const comp = event.competitions?.[0]
  if (!comp) throw new Error(`ESPN event ${event.id} has no competition`)

  const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
  const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
  if (!home || !away) throw new Error(`ESPN event ${event.id} missing competitors`)

  const status = comp.status ?? event.status ?? {}
  const statusType = status.type ?? {}
  const statusState: string = statusType.state ?? 'pre'
  const statusName: string = statusType.name ?? ''
  const completed: boolean = Boolean(statusType.completed)
  const canceled = CANCELED_STATUSES.has(statusName)

  const homeAbbr = home.team?.abbreviation ?? ''
  const awayAbbr = away.team?.abbreviation ?? ''

  const odds = comp.odds?.[0] ?? null
  const homeSpread = parseHomeSpread(odds, homeAbbr, awayAbbr)

  const toScore = (c: any): number | null => {
    const n = parseInt(c.score, 10)
    return Number.isFinite(n) ? n : null
  }

  return {
    espnId: String(event.id),
    season: Number(event.season?.year ?? new Date(event.date).getFullYear()),
    week: Number(event.week?.number ?? 0),
    kickoff: new Date(event.date),
    statusState,
    statusDetail: statusType.detail ?? statusName ?? null,
    completed,
    canceled,
    homeTeamName: home.team?.displayName ?? 'Home',
    homeTeamAbbr: homeAbbr,
    homeTeamLogo: home.team?.logo ?? '',
    awayTeamName: away.team?.displayName ?? 'Away',
    awayTeamAbbr: awayAbbr,
    awayTeamLogo: away.team?.logo ?? '',
    homeScore: toScore(home),
    awayScore: toScore(away),
    period: typeof status.period === 'number' ? status.period : null,
    displayClock: status.displayClock ?? null,
    homeSpread,
    spreadDetails: odds?.details ?? null,
  }
}

/** True if this scoreboard event belongs to the NFL regular season. */
export function isRegularSeason(event: any): boolean {
  return event?.season?.type === 2
}

/**
 * The NFL season year for a given date. A season spans Sep–Feb, so January/February
 * belong to the *previous* year's season (playoffs); from March onward we're pointed at
 * the upcoming season.
 */
export function nflSeasonYear(now: Date): number {
  const year = now.getUTCFullYear()
  return now.getUTCMonth() >= 2 ? year : year - 1
}
