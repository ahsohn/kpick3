import { fetchScoreboardCached } from './fetch'
import type { Game } from '@/lib/db/schema'

export interface LiveOverlay {
  statusState: string
  statusDetail: string | null
  homeScore: number | null
  awayScore: number | null
  period: number | null
  displayClock: string | null
}

/**
 * Render-time live scores, keyed by espnId. Fresher than the last cron tick for
 * in-progress games; degrades to an empty map if ESPN is unreachable. Never used for
 * grading — only for display.
 */
export async function getLiveOverlays(): Promise<Map<string, LiveOverlay>> {
  const map = new Map<string, LiveOverlay>()
  try {
    const data = await fetchScoreboardCached()
    for (const event of data.events ?? []) {
      const comp = event.competitions?.[0]
      const status = comp?.status ?? {}
      const state = status.type?.state
      if (state !== 'in' && state !== 'post') continue
      const home = comp.competitors?.find((c: any) => c.homeAway === 'home')
      const away = comp.competitors?.find((c: any) => c.homeAway === 'away')
      const toScore = (c: any): number | null => {
        const n = parseInt(c?.score, 10)
        return Number.isFinite(n) ? n : null
      }
      map.set(String(event.id), {
        statusState: state,
        statusDetail: status.type?.shortDetail ?? status.type?.detail ?? null,
        homeScore: toScore(home),
        awayScore: toScore(away),
        period: typeof status.period === 'number' ? status.period : null,
        displayClock: status.displayClock ?? null,
      })
    }
  } catch {
    // Page still renders from the DB without the live overlay.
  }
  return map
}

/** Merges a live overlay (if any) over the DB row for display. */
export function withLive(game: Game, overlays: Map<string, LiveOverlay>): Game {
  const live = overlays.get(game.espnId)
  if (!live) return game
  return {
    ...game,
    statusState: live.statusState,
    statusDetail: live.statusDetail ?? game.statusDetail,
    homeScore: live.homeScore ?? game.homeScore,
    awayScore: live.awayScore ?? game.awayScore,
    period: live.period ?? game.period,
    displayClock: live.displayClock ?? game.displayClock,
  }
}
