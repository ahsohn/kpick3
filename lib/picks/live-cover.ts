import { gradePick } from './grading'

export type LiveCover = 'covering' | 'trailing' | 'on-number'

/**
 * Where a pick stands against its locked line at the current live score. Display only —
 * grading always waits for the final. Null when there's no score to judge against.
 */
export function liveCover(
  side: 'home' | 'away',
  lockedSpread: number,
  homeScore: number | null,
  awayScore: number | null
): LiveCover | null {
  if (homeScore === null || awayScore === null) return null
  const r = gradePick(side, lockedSpread, homeScore, awayScore)
  return r === 'win' ? 'covering' : r === 'loss' ? 'trailing' : 'on-number'
}

export const LIVE_COVER_LABEL: Record<LiveCover, string> = {
  covering: 'COVERING',
  trailing: 'NOT COVERING',
  'on-number': 'ON THE NUMBER',
}

export const LIVE_COVER_COLOR: Record<LiveCover, string> = {
  covering: 'text-green',
  trailing: 'text-accent',
  'on-number': 'text-amber',
}
