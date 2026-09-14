import { db } from '@/lib/db'
import { games } from '@/lib/db/schema'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { fetchScoreboardCached } from './fetch'
import { isRegularSeason } from './parse'
import { settleFinalEvents } from './sync'

const CANCELED_STATUSES = new Set(['STATUS_CANCELED', 'STATUS_FORFEIT'])

/** Regular-season scoreboard events that are final (or canceled) and so may need grading. */
export function pickFinalEvents(events: any[] | undefined): any[] {
  return (events ?? []).filter((event) => {
    if (!isRegularSeason(event)) return false
    const type = event.competitions?.[0]?.status?.type ?? event.status?.type ?? {}
    return type.state === 'post' || CANCELED_STATUSES.has(type.name ?? '')
  })
}

/**
 * Visit-time grading: if the (cached) scoreboard shows a final the DB hasn't graded yet,
 * write the final and grade its picks right now instead of waiting for the hourly cron.
 * Returns the scoreboard so callers that also want live overlays don't fetch twice.
 * Never throws — a page must render even if ESPN or the DB hiccups.
 */
export async function settleFinalsOnVisit(): Promise<any | null> {
  let data: any
  try {
    data = await fetchScoreboardCached()
  } catch {
    return null
  }
  try {
    await settleFromScoreboard(data)
  } catch (err) {
    console.error('[settle] visit-time grading failed:', err)
  }
  return data
}

async function settleFromScoreboard(data: any): Promise<void> {
  const finals = pickFinalEvents(data?.events)
  if (finals.length === 0) return

  const ungraded = await db
    .select({ espnId: games.espnId })
    .from(games)
    .where(and(
      inArray(games.espnId, finals.map((e) => String(e.id))),
      isNull(games.gradedAt),
      eq(games.needsReview, false),
    ))
  if (ungraded.length === 0) return

  const pending = new Set(ungraded.map((g) => g.espnId))
  await settleFinalEvents(finals.filter((e) => pending.has(String(e.id))))
}
