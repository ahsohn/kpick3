'use server'

import { db } from '@/lib/db'
import { games, survivorPicks } from '@/lib/db/schema'
import { and, eq, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/session'
import { getCurrentWeek } from '@/lib/picks/queries'
import { isEnrolled, getSurvivorStatusForUser } from '@/lib/survivor/queries'
import type { SubmitResult } from './picks'

/**
 * Submits (or replaces) the caller's survivor pick for the current week. All rules are
 * enforced here, server-side: enrolled and still alive, game not kicked off, current
 * week only, and the team hasn't been used before this season. Submitting a new pick
 * atomically replaces an existing unlocked one.
 */
export async function submitSurvivorPick(input: {
  gameId: number
  side: 'home' | 'away'
}): Promise<SubmitResult> {
  const user = await requireUser()

  if (input.side !== 'home' && input.side !== 'away') return { error: 'Invalid side.' }

  const rows = await db.select().from(games).where(eq(games.id, input.gameId))
  const game = rows[0]
  if (!game) return { error: 'Unknown game.' }
  if (game.canceled) return { error: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr} was canceled.` }
  const now = new Date()
  if (game.kickoff <= now || game.statusState !== 'pre') {
    return { error: `${game.awayTeamAbbr} @ ${game.homeTeamAbbr} has already started.` }
  }

  const currentWeek = await getCurrentWeek(game.season)
  if (game.week !== currentWeek) {
    return { error: `Survivor picks are for the current week (week ${currentWeek}) only.` }
  }

  if (!(await isEnrolled(user.id, game.season))) {
    return { error: 'You are not in this season’s survivor pool.' }
  }
  const status = await getSurvivorStatusForUser(user.id, game.season)
  if (!status.alive) {
    return { error: `You were eliminated in week ${status.eliminatedWeek} — no more picks.` }
  }

  const teamAbbr = input.side === 'home' ? game.homeTeamAbbr : game.awayTeamAbbr
  const teamName = input.side === 'home' ? game.homeTeamName : game.awayTeamName

  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(survivorPicks)
        .innerJoin(games, eq(games.id, survivorPicks.gameId))
        .where(and(
          eq(survivorPicks.userId, user.id),
          eq(survivorPicks.season, game.season),
          eq(survivorPicks.week, game.week),
          ne(survivorPicks.result, 'void'),
        ))

      const current = existing[0]
      if (current) {
        if (current.games.kickoff <= new Date() || current.games.statusState !== 'pre') {
          throw new Error('Your pick this week is locked — its game already kicked off.')
        }
        await tx.delete(survivorPicks).where(eq(survivorPicks.id, current.survivor_picks.id))
      }

      const used = await tx
        .select({ teamAbbr: survivorPicks.teamAbbr })
        .from(survivorPicks)
        .where(and(
          eq(survivorPicks.userId, user.id),
          eq(survivorPicks.season, game.season),
          ne(survivorPicks.result, 'void'),
        ))
      if (used.some((u) => u.teamAbbr === teamAbbr)) {
        throw new Error(`You already used ${teamName} this season — one ride per team.`)
      }

      await tx.insert(survivorPicks).values({
        userId: user.id,
        gameId: game.id,
        season: game.season,
        week: game.week,
        side: input.side,
        teamAbbr,
      })
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('survivor_picks_user_team_uq')) {
      return { error: `You already used ${teamName} this season — one ride per team.` }
    }
    if (msg.includes('survivor_picks_user_week_uq')) {
      return { error: 'You already have a pick in for this week.' }
    }
    return { error: msg || 'Could not save your pick. Try again.' }
  }

  revalidatePath('/')
  revalidatePath('/survivor')
  return { ok: true }
}

/**
 * Removes the caller's pending survivor pick for the current week, allowed only while
 * its game hasn't kicked off.
 */
export async function removeSurvivorPick(): Promise<SubmitResult> {
  const user = await requireUser()

  const rows = await db
    .select()
    .from(survivorPicks)
    .innerJoin(games, eq(games.id, survivorPicks.gameId))
    .where(and(eq(survivorPicks.userId, user.id), eq(survivorPicks.result, 'pending')))

  const now = new Date()
  const removable = rows.find(
    (r) => r.games.kickoff > now && r.games.statusState === 'pre'
  )
  if (!removable) return { error: 'No removable pick — picks are final at kickoff.' }

  await db.delete(survivorPicks).where(and(
    eq(survivorPicks.id, removable.survivor_picks.id),
    eq(survivorPicks.result, 'pending'),
  ))

  revalidatePath('/')
  revalidatePath('/survivor')
  return { ok: true }
}
