'use server'

import { db } from '@/lib/db'
import { games, users, picks, survivorEntries, survivorPicks } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/session'
import { runSyncPass, gradeFinishedGames } from '@/lib/espn/sync'
import { getCurrentSeason } from '@/lib/picks/queries'

export interface AdminResult {
  ok?: boolean
  error?: string
  info?: string
}

export async function addUser(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const displayName = String(formData.get('displayName') ?? '').trim()
  if (!email || !email.includes('@')) return { error: 'Enter a valid email.' }
  if (!displayName) return { error: 'Enter a display name.' }

  const existing = await db.select().from(users).where(eq(users.email, email))
  if (existing.length > 0) return { error: 'That email is already registered.' }

  await db.insert(users).values({ email, displayName })
  revalidatePath('/admin')
  return { ok: true, info: `Added ${displayName}.` }
}

/** Renames a player. Standings, picks and survivor pages all read the live name. */
export async function renamePlayer(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin()
  const userId = parseInt(String(formData.get('userId')), 10)
  const displayName = String(formData.get('displayName') ?? '').trim()
  if (!Number.isFinite(userId)) return { error: 'Bad user id.' }
  if (!displayName) return { error: 'Enter a display name.' }

  const updated = await db
    .update(users)
    .set({ displayName })
    .where(eq(users.id, userId))
    .returning()
  if (updated.length === 0) return { error: 'Player not found.' }

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/all-picks')
  revalidatePath('/standings')
  revalidatePath('/survivor')
  return { ok: true, info: `Renamed to ${displayName}.` }
}

export async function runSyncNow(): Promise<AdminResult> {
  await requireAdmin()
  try {
    const result = await runSyncPass()
    revalidatePath('/')
    revalidatePath('/admin')
    return {
      ok: true,
      info: `Synced ${result.synced} games · graded ${result.gradedGames} · flagged ${result.flagged} · voided ${result.voided} · survivor picks graded ${result.survivorGraded}.`,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sync failed.' }
  }
}

/**
 * Resolves a game flagged for review: the admin confirms the final score, then the
 * normal grading pass runs against it.
 */
export async function resolveFlaggedGame(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin()
  const gameId = parseInt(String(formData.get('gameId')), 10)
  const homeScore = parseInt(String(formData.get('homeScore')), 10)
  const awayScore = parseInt(String(formData.get('awayScore')), 10)
  if (!Number.isFinite(gameId)) return { error: 'Bad game id.' }
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore < 0 || awayScore < 0) {
    return { error: 'Enter both final scores.' }
  }

  const rows = await db.select().from(games).where(eq(games.id, gameId))
  const game = rows[0]
  if (!game) return { error: 'Game not found.' }
  if (!game.needsReview) return { error: 'Game is not flagged for review.' }

  await db
    .update(games)
    .set({ homeScore, awayScore, completed: true, needsReview: false, updatedAt: new Date() })
    .where(eq(games.id, gameId))
  await gradeFinishedGames()

  revalidatePath('/admin')
  return { ok: true, info: `Confirmed ${game.awayTeamAbbr} ${awayScore} – ${homeScore} ${game.homeTeamAbbr} and graded picks.` }
}

/** Voids all pending picks on a game (e.g. indefinitely postponed). */
export async function voidGamePicks(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin()
  const gameId = parseInt(String(formData.get('gameId')), 10)
  if (!Number.isFinite(gameId)) return { error: 'Bad game id.' }

  const rows = await db.select().from(games).where(eq(games.id, gameId))
  const game = rows[0]
  if (!game) return { error: 'Game not found.' }

  await db
    .update(picks)
    .set({ result: 'void', gradedAt: new Date() })
    .where(and(eq(picks.gameId, gameId), eq(picks.result, 'pending')))
  await db
    .update(survivorPicks)
    .set({ result: 'void', gradedAt: new Date() })
    .where(and(eq(survivorPicks.gameId, gameId), eq(survivorPicks.result, 'pending')))
  await db
    .update(games)
    .set({ canceled: true, needsReview: false, gradedAt: new Date(), updatedAt: new Date() })
    .where(eq(games.id, gameId))

  revalidatePath('/admin')
  return { ok: true, info: `Voided pending picks on ${game.awayTeamAbbr} @ ${game.homeTeamAbbr}.` }
}

/** Enrolls a player in the current season's survivor pool. */
export async function enrollSurvivorPlayer(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin()
  const userId = parseInt(String(formData.get('userId')), 10)
  if (!Number.isFinite(userId)) return { error: 'Bad user id.' }

  const season = await getCurrentSeason()
  if (season === null) return { error: 'No season yet — run a sync first.' }

  const rows = await db.select().from(users).where(eq(users.id, userId))
  const player = rows[0]
  if (!player) return { error: 'Player not found.' }

  const existing = await db
    .select()
    .from(survivorEntries)
    .where(and(eq(survivorEntries.userId, userId), eq(survivorEntries.season, season)))
  if (existing.length > 0) return { error: `${player.displayName} is already in the survivor pool.` }

  await db.insert(survivorEntries).values({ userId, season })
  revalidatePath('/admin')
  revalidatePath('/survivor')
  revalidatePath('/')
  return { ok: true, info: `${player.displayName} is in the ${season} survivor pool.` }
}

/**
 * Removes a player from the survivor pool — only while they have no picks this season,
 * so a mistaken enrollment is fixable but pool history can't be erased.
 */
export async function unenrollSurvivorPlayer(_prev: AdminResult, formData: FormData): Promise<AdminResult> {
  await requireAdmin()
  const userId = parseInt(String(formData.get('userId')), 10)
  if (!Number.isFinite(userId)) return { error: 'Bad user id.' }

  const season = await getCurrentSeason()
  if (season === null) return { error: 'No season yet — run a sync first.' }

  const picksMade = await db
    .select({ id: survivorPicks.id })
    .from(survivorPicks)
    .where(and(eq(survivorPicks.userId, userId), eq(survivorPicks.season, season)))
    .limit(1)
  if (picksMade.length > 0) {
    return { error: 'That player has already made survivor picks this season — they stay in the pool.' }
  }

  const deleted = await db
    .delete(survivorEntries)
    .where(and(eq(survivorEntries.userId, userId), eq(survivorEntries.season, season)))
    .returning()
  if (deleted.length === 0) return { error: 'That player is not in the survivor pool.' }

  revalidatePath('/admin')
  revalidatePath('/survivor')
  revalidatePath('/')
  return { ok: true, info: 'Removed from the survivor pool.' }
}
