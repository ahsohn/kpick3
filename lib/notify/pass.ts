import { db } from '@/lib/db'
import { games, notifications, users } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'
import {
  getCurrentSeason,
  getCurrentWeek,
  getGamesForWeek,
  getStandings,
  getUserPicksForWeek,
} from '@/lib/picks/queries'
import {
  getSurvivorSeasonData,
  getSurvivorStatusForUser,
  getUsedTeams,
  getUserSurvivorPickForWeek,
  isEnrolled,
} from '@/lib/survivor/queries'
import { weeklyPoints, type PickResult } from '@/lib/picks/grading'
import { formatSpread } from '@/lib/format'
import { sendEmail } from '@/lib/email/send'
import { signUnsubscribeToken } from '@/lib/email/unsubscribe'
import { reminderWindow } from './windows'
import { needsPick3Reminder, needsSurvivorReminder, pickableGames, weekFullyGraded } from './eligibility'
import { reminderEmail, recapEmail, needsReviewEmail, SITE_URL } from './emails'

/**
 * Runs after every sync pass. Each sub-pass is independently fault-isolated and every
 * send sits behind a dedupe-key claim, so the hourly cron can re-run all of this
 * freely — the second tick of a window is a pile of no-ops.
 */
export async function runNotifyPass(now: Date = new Date()) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    console.log('[notify] RESEND_API_KEY or EMAIL_FROM not set; skipping notify pass')
    return { reminders: 0, recaps: 0, adminAlerts: 0 }
  }

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
    const pickedGameIds = new Set(myPicks.map((p) => p.gameId))
    const wantsPick3 = needsPick3Reminder(myPicks.length, weekGames, now, pickedGameIds)

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

    // Compose the email FIRST, then claim per-pool keys immediately before sending.
    // Isolated per player: a thrown error (network failure, missing SESSION_SECRET,
    // etc.) must not abort the rest of the batch, and must release this player's
    // claims so a future tick can retry instead of being permanently blocked by the
    // unique index. Keeping the claim window as close to the send as possible means a
    // hard function kill mid-pass is far more likely to strike before the claim (safe
    // retry next tick) than between claim and send (which would strand it).
    const claimed: string[] = []
    try {
      const unsub = unsubscribeUrl(player.id)
      const availablePickable = pickableGames(weekGames, now).filter((g) => !pickedGameIds.has(g.id))
      const nextKickoff = availablePickable[0]?.kickoff ?? null
      const content = reminderEmail({
        displayName: player.displayName,
        window,
        week,
        pick3: wantsPick3 && nextKickoff ? { pickCount: myPicks.length, nextKickoff } : null,
        survivor: wantsSurvivor ? { remainingPickable: survivorPickable } : null,
        unsubscribeUrl: unsub,
      })

      if (wantsPick3) {
        const key = `reminder:pick3:${window}:${season}:w${week}:u${player.id}`
        if (await claimKey('reminder', key, player.id)) claimed.push(key)
      }
      if (wantsSurvivor) {
        const key = `reminder:survivor:${window}:${season}:w${week}:u${player.id}`
        if (await claimKey('reminder', key, player.id)) claimed.push(key)
      }
      if (claimed.length === 0) continue // every needed pool already sent this window

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
    } catch (err) {
      await releaseKeys(claimed)
      console.error(`[notify] reminder to ${player.email} threw:`, err)
    }
  }
  return sent
}

/**
 * Recaps target the current AND previous week: the sync's auto-detected week rolls
 * forward around Tuesday — exactly when the finished week's recap comes due — and the
 * two-week bound keeps a mid-season deploy from backfilling the whole past season.
 */
async function runRecapPass(now: Date): Promise<number> {
  const season = await getCurrentSeason()
  if (season === null) return 0
  const currentWeek = await getCurrentWeek(season)
  const targetWeeks = [...new Set([currentWeek, currentWeek - 1])].filter((w) => w >= 1)

  let sent = 0
  for (const week of targetWeeks) {
    const weekGames = await getGamesForWeek(season, week)
    if (!weekFullyGraded(weekGames)) continue

    const players = await db.select().from(users).where(eq(users.emailOptOut, false))
    const standingsRows = await getStandings(season)
    // viewerId 0 = no viewer: cell visibility doesn't matter here, statuses/champions do.
    const survivor = await getSurvivorSeasonData(season, 0)
    const eliminated = survivor.rows
      .filter((r) => r.status.eliminatedWeek === week)
      .map((r) => r.displayName)
    const champions = survivor.champions.over && survivor.champions.decidedWeek === week
      ? survivor.rows.filter((r) => survivor.champions.championUserIds.includes(r.userId)).map((r) => r.displayName)
      : []
    const gameById = new Map(weekGames.map((g) => [g.id, g]))

    for (const player of players) {
      const key = `recap:${season}:w${week}:u${player.id}`
      const claimed: string[] = []

      // Gather data and compose the email FIRST, then claim immediately before
      // sending. Isolated per player: a thrown error — including from the claim
      // itself — must not abort the rest of the batch, and must release this
      // player's claim (if taken) so a future tick can retry. Keeping the claim
      // window as close to the send as possible means a hard function kill mid-pass
      // is far more likely to strike before the claim (safe retry next tick) than
      // between claim and send (which would strand it and permanently suppress the
      // recap).
      try {
        const myPicks = await getUserPicksForWeek(player.id, season, week)
        const results = myPicks.map((p) => p.result as PickResult)
        const { points, parlay } = weeklyPoints(results)
        const pickLines = myPicks.map((p) => {
          const g = gameById.get(p.gameId)
          const label = g
            ? p.side === 'home'
              ? `${g.homeTeamAbbr} ${formatSpread(p.lockedSpread)} vs ${g.awayTeamAbbr}`
              : `${g.awayTeamAbbr} ${formatSpread(p.lockedSpread)} @ ${g.homeTeamAbbr}`
            : `game ${p.gameId}`
          return { label, result: p.result as PickResult }
        })
        const topStandings = standingsRows.slice(0, 5).map((s) => ({
          displayName: s.displayName, points: s.points, isYou: s.userId === player.id,
        }))
        const myRank = standingsRows.findIndex((s) => s.userId === player.id)
        if (myRank >= 5) {
          const s = standingsRows[myRank]
          topStandings.push({ displayName: s.displayName, points: s.points, isYou: true })
        }

        const unsub = unsubscribeUrl(player.id)
        const content = recapEmail({
          displayName: player.displayName,
          week,
          myPicks: pickLines,
          weekPoints: points,
          parlay,
          standings: topStandings,
          survivorEliminated: eliminated,
          survivorChampions: champions,
          unsubscribeUrl: unsub,
        })

        if (!(await claimKey('recap', key, player.id))) continue
        claimed.push(key)

        const result = await sendEmail({
          to: player.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
          headers: { 'List-Unsubscribe': `<${unsub}>` },
        })
        if (!result.sent) {
          await releaseKeys(claimed)
          console.error(`[notify] recap to ${player.email} failed: ${result.reason}`)
          continue
        }
        sent++
      } catch (err) {
        await releaseKeys(claimed)
        console.error(`[notify] recap to ${player.email} threw:`, err)
      }
    }
  }
  return sent
}

/**
 * Emails the super admin about newly flagged finals. One email per batch of new
 * flags; each game alerts once ever (resolving it clears the flag, and re-flagging
 * the same game id stays deduped — acceptable for this failure mode).
 */
async function runAdminAlertPass(): Promise<number> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return 0

  const flagged = await db.select().from(games).where(eq(games.needsReview, true))
  const fresh: typeof flagged = []
  const claimed: string[] = []
  for (const g of flagged) {
    const key = `needs_review:g${g.id}`
    if (await claimKey('needs_review', key, null)) {
      fresh.push(g)
      claimed.push(key)
    }
  }
  if (fresh.length === 0) return 0

  const content = needsReviewEmail(
    fresh.map((g) => ({ week: g.week, awayTeamAbbr: g.awayTeamAbbr, homeTeamAbbr: g.homeTeamAbbr }))
  )
  const result = await sendEmail({
    to: adminEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
  })
  if (!result.sent) {
    await releaseKeys(claimed)
    console.error(`[notify] admin alert failed: ${result.reason}`)
    return 0
  }
  return 1
}
