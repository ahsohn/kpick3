import { db } from '@/lib/db'
import { notifications, users } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import {
  getCurrentSeason,
  getCurrentWeek,
  getGamesForWeek,
  getUserPicksForWeek,
} from '@/lib/picks/queries'
import {
  getSurvivorStatusForUser,
  getUsedTeams,
  getUserSurvivorPickForWeek,
  isEnrolled,
} from '@/lib/survivor/queries'
import { sendEmail } from '@/lib/email/send'
import { signUnsubscribeToken } from '@/lib/email/unsubscribe'
import { reminderWindow } from './windows'
import { needsPick3Reminder, needsSurvivorReminder, pickableGames } from './eligibility'
import { reminderEmail, SITE_URL } from './emails'

/**
 * Runs after every sync pass. Each sub-pass is independently fault-isolated and every
 * send sits behind a dedupe-key claim, so the hourly cron can re-run all of this
 * freely — the second tick of a window is a pile of no-ops.
 */
export async function runNotifyPass(now: Date = new Date()) {
  const [reminders, recaps, adminAlerts] = [
    await runReminderPass(now).catch((err) => { console.error('[notify] reminders failed:', err); return 0 }),
    await runRecapPass(now).catch((err) => { console.error('[notify] recaps failed:', err); return 0 }),
    await runAdminAlertPass().catch((err) => { console.error('[notify] admin alerts failed:', err); return 0 }),
  ]
  return { reminders, recaps, adminAlerts }
}

/** Claims a dedupe key. True = ours to send; false = a previous tick already sent it. */
async function claimKey(kind: string, dedupeKey: string, userId: number | null): Promise<boolean> {
  const rows = await db
    .insert(notifications)
    .values({ kind, dedupeKey, userId })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning({ id: notifications.id })
  return rows.length > 0
}

/** Releases claims after a failed send so the next hourly tick retries. */
async function releaseKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await db.delete(notifications).where(inArray(notifications.dedupeKey, keys))
}

function unsubscribeUrl(userId: number): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(userId, secret))}`
}

async function runReminderPass(now: Date): Promise<number> {
  const window = reminderWindow(now)
  if (!window) return 0
  const season = await getCurrentSeason()
  if (season === null) return 0
  const week = await getCurrentWeek(season)
  const weekGames = await getGamesForWeek(season, week)
  if (pickableGames(weekGames, now).length === 0) return 0

  const players = await db.select().from(users).where(eq(users.emailOptOut, false))

  let sent = 0
  for (const player of players) {
    const myPicks = await getUserPicksForWeek(player.id, season, week)
    const wantsPick3 = needsPick3Reminder(myPicks.length, weekGames, now)

    let wantsSurvivor = false
    let survivorPickable = 0
    if (await isEnrolled(player.id, season)) {
      const [status, existingPick, used] = await Promise.all([
        getSurvivorStatusForUser(player.id, season),
        getUserSurvivorPickForWeek(player.id, season, week),
        getUsedTeams(player.id, season),
      ])
      const usedSet = new Set(used.keys())
      const state = {
        enrolled: true,
        alive: status.alive,
        hasPickThisWeek: existingPick !== null,
        usedTeams: usedSet,
      }
      wantsSurvivor = needsSurvivorReminder(state, weekGames, now)
      survivorPickable = pickableGames(weekGames, now).filter(
        (g) => !usedSet.has(g.homeTeamAbbr) || !usedSet.has(g.awayTeamAbbr)
      ).length
    }

    if (!wantsPick3 && !wantsSurvivor) continue

    // Claim per-pool keys, then send one combined email covering both.
    const claimed: string[] = []
    if (wantsPick3) {
      const key = `reminder:pick3:${window}:${season}:w${week}:u${player.id}`
      if (await claimKey('reminder', key, player.id)) claimed.push(key)
    }
    if (wantsSurvivor) {
      const key = `reminder:survivor:${window}:${season}:w${week}:u${player.id}`
      if (await claimKey('reminder', key, player.id)) claimed.push(key)
    }
    if (claimed.length === 0) continue // every needed pool already sent this window

    const unsub = unsubscribeUrl(player.id)
    const nextKickoff = pickableGames(weekGames, now)[0]?.kickoff ?? null
    const content = reminderEmail({
      displayName: player.displayName,
      window,
      week,
      pick3: wantsPick3 && nextKickoff ? { pickCount: myPicks.length, nextKickoff } : null,
      survivor: wantsSurvivor ? { remainingPickable: survivorPickable } : null,
      unsubscribeUrl: unsub,
    })
    const result = await sendEmail({
      to: player.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      headers: { 'List-Unsubscribe': `<${unsub}>` },
    })
    if (!result.sent) {
      await releaseKeys(claimed)
      console.error(`[notify] reminder to ${player.email} failed: ${result.reason}`)
      continue
    }
    sent++
  }
  return sent
}

async function runRecapPass(_now: Date): Promise<number> {
  return 0 // implemented in the next task
}

async function runAdminAlertPass(): Promise<number> {
  return 0 // implemented in a later task
}
