import type { Game } from '@/lib/db/schema'
import { formatKickoff, formatKickoffDay, formatKickoffTime } from '@/lib/format'

/** Serializable game shape passed to client components. */
export interface BoardGame {
  id: number
  kickoffIso: string
  kickoffLabel: string
  kickoffDay: string
  kickoffTime: string
  statusState: string
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
  homeSpread: number | null
  oddsAvailable: boolean
}

export function toBoardGame(g: Game): BoardGame {
  return {
    id: g.id,
    kickoffIso: g.kickoff.toISOString(),
    kickoffLabel: formatKickoff(g.kickoff),
    kickoffDay: formatKickoffDay(g.kickoff),
    kickoffTime: formatKickoffTime(g.kickoff),
    statusState: g.statusState,
    statusDetail: g.statusDetail,
    completed: g.completed,
    canceled: g.canceled,
    homeTeamName: g.homeTeamName,
    homeTeamAbbr: g.homeTeamAbbr,
    homeTeamLogo: g.homeTeamLogo,
    awayTeamName: g.awayTeamName,
    awayTeamAbbr: g.awayTeamAbbr,
    awayTeamLogo: g.awayTeamLogo,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    homeSpread: g.homeSpread,
    oddsAvailable: g.oddsAvailable,
  }
}
