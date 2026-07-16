'use server'

import { db } from '@/lib/db'
import { games, users, picks } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/session'
import { runSyncPass, gradeFinishedGames } from '@/lib/espn/sync'

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

export async function runSyncNow(): Promise<AdminResult> {
  await requireAdmin()
  try {
    const result = await runSyncPass()
    revalidatePath('/')
    revalidatePath('/admin')
    return {
      ok: true,
      info: `Synced ${result.synced} games · graded ${result.gradedGames} · flagged ${result.flagged} · voided ${result.voided}.`,
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
    .update(games)
    .set({ canceled: true, needsReview: false, gradedAt: new Date(), updatedAt: new Date() })
    .where(eq(games.id, gameId))

  revalidatePath('/admin')
  return { ok: true, info: `Voided pending picks on ${game.awayTeamAbbr} @ ${game.homeTeamAbbr}.` }
}
