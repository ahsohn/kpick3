'use server'

import { db } from '@/lib/db'
import { games, picks } from '@/lib/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { spreadForSide } from '@/lib/format'

export interface SubmitResult {
  ok?: boolean
  error?: string
}

const MAX_PICKS_PER_WEEK = 3

/**
 * Submits 1–3 picks. All rules are enforced here, server-side: game must exist, have a
 * posted line, and not have kicked off; one pick per game; at most 3 picks per week.
 * The current spread is copied onto each pick — that's the number it's graded on.
 */
export async function submitPicks(
  input: { gameId: number; side: 'home' | 'away' }[]
): Promise<SubmitResult> {
  const user = await requireUser()

  if (!Array.isArray(input) || input.length === 0) return { error: 'Select at least one game.' }
  if (input.length > MAX_PICKS_PER_WEEK) return { error: `At most ${MAX_PICKS_PER_WEEK} picks.` }
  const gameIds = input.map((p) => p.gameId)
  if (new Set(gameIds).size !== gameIds.length) return { error: 'One pick per game.' }
  for (const p of input) {
    if (p.side !== 'home' && p.side !== 'away') return { error: 'Invalid side.' }
  }

  const rows = await db.select().from(games).where(inArray(games.id, gameIds))
  if (rows.length !== gameIds.length) return { error: 'Unknown game.' }

  const now = new Date()
  for (const g of rows) {
    if (g.canceled) return { error: `${g.awayTeamAbbr} @ ${g.homeTeamAbbr} was canceled.` }
    if (g.kickoff <= now || g.statusState !== 'pre') {
      return { error: `${g.awayTeamAbbr} @ ${g.homeTeamAbbr} has already started.` }
    }
    if (g.homeSpread === null) {
      return { error: `No line posted yet for ${g.awayTeamAbbr} @ ${g.homeTeamAbbr}.` }
    }
  }

  // All picks in one submission must belong to one week (the UI only offers one week).
  const season = rows[0].season
  const week = rows[0].week
  if (!rows.every((g) => g.season === season && g.week === week)) {
    return { error: 'Picks must all be in the same week.' }
  }

  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(picks)
        .where(and(eq(picks.userId, user.id), eq(picks.season, season), eq(picks.week, week)))

      if (existing.length + input.length > MAX_PICKS_PER_WEEK) {
        throw new Error(`You can only make ${MAX_PICKS_PER_WEEK} picks per week — you already have ${existing.length}.`)
      }
      const existingGameIds = new Set(existing.map((p) => p.gameId))
      for (const p of input) {
        if (existingGameIds.has(p.gameId)) throw new Error('You already picked one of these games.')
      }

      await tx.insert(picks).values(
        input.map((p) => {
          const game = rows.find((g) => g.id === p.gameId)!
          return {
            userId: user.id,
            gameId: p.gameId,
            season,
            week,
            side: p.side,
            lockedSpread: spreadForSide(game.homeSpread!, p.side),
          }
        })
      )
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save picks. Try again.' }
  }

  revalidatePath('/')
  revalidatePath('/my-picks')
  revalidatePath('/all-picks')
  return { ok: true }
}
