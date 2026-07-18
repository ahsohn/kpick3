import { db } from '@/lib/db'
import { games, picks, survivorPicks } from '@/lib/db/schema'
import { and, eq, isNull, lt, ne, sql } from 'drizzle-orm'
import { fetchScoreboard } from './fetch'
import { parseEvent, isRegularSeason, nflSeasonYear, type ParsedGame } from './parse'
import { gradePick } from '@/lib/picks/grading'
import { gradeSurvivorPick } from '@/lib/survivor/logic'

/**
 * One cron pass: pull the current ESPN scoreboard, upsert regular-season games (keeping
 * spreads fresh until kickoff), re-fetch any earlier weeks that still have ungraded
 * started games, then grade picks for every newly-final game.
 */
export async function runSyncPass() {
  let data = await fetchScoreboard()

  // Outside the regular season ESPN's default scoreboard serves preseason (Aug),
  // playoffs (Jan) or the offseason. Explicitly load week 1 of the season we care
  // about instead (the year must be pinned — ESPN serves the *previous* season's week 1
  // otherwise), so picks open as soon as ESPN posts lines. During playoffs this just
  // re-upserts already-final week 1 games, which is harmless.
  if (data.season?.type !== 2) {
    data = await fetchScoreboard({ season: nflSeasonYear(new Date()), week: 1 })
  }

  const events: any[] = (data.events ?? []).filter(isRegularSeason)
  const parsed = events.map(parseEvent)
  for (const g of parsed) await upsertGame(g)

  // Catch-up: a game from a previous week that started but never got a final (e.g. the
  // cron was down, or a postponed game moved weeks) won't be on the current scoreboard.
  const currentWeeks = new Set(parsed.map((g) => `${g.season}:${g.week}`))
  const stale = await db
    .selectDistinct({ season: games.season, week: games.week })
    .from(games)
    .where(and(
      eq(games.completed, false),
      eq(games.canceled, false),
      lt(games.kickoff, new Date(Date.now() - 4 * 60 * 60 * 1000)),
    ))
  for (const { season, week } of stale) {
    if (currentWeeks.has(`${season}:${week}`)) continue
    const weekData = await fetchScoreboard({ season, week })
    const weekEvents: any[] = (weekData.events ?? []).filter(isRegularSeason)
    for (const g of weekEvents.map(parseEvent)) await upsertGame(g)
  }

  const graded = await gradeFinishedGames()
  return { synced: parsed.length, ...graded }
}

async function upsertGame(g: ParsedGame) {
  const oddsAvailable = g.homeSpread !== null
  await db
    .insert(games)
    .values({
      espnId: g.espnId,
      season: g.season,
      week: g.week,
      kickoff: g.kickoff,
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
      period: g.period,
      displayClock: g.displayClock,
      homeSpread: g.homeSpread,
      spreadDetails: g.spreadDetails,
      oddsAvailable,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: games.espnId,
      set: {
        season: g.season,
        week: g.week,
        kickoff: g.kickoff,
        statusState: g.statusState,
        statusDetail: g.statusDetail,
        completed: g.completed,
        canceled: g.canceled,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        period: g.period,
        displayClock: g.displayClock,
        // Keep the last good line once ESPN strips odds near/after kickoff.
        homeSpread: oddsAvailable ? g.homeSpread : sql`${games.homeSpread}`,
        spreadDetails: oddsAvailable ? g.spreadDetails : sql`${games.spreadDetails}`,
        oddsAvailable: oddsAvailable ? true : sql`${games.oddsAvailable}`,
        updatedAt: new Date(),
      },
    })
}

/**
 * Grades pending picks on games that reached a final (or were canceled) and haven't been
 * graded yet. A final missing a score is flagged for admin review instead of guessing.
 */
export async function gradeFinishedGames() {
  const ungraded = await db
    .select()
    .from(games)
    .where(and(
      isNull(games.gradedAt),
      ne(games.needsReview, true),
    ))

  let gradedGames = 0
  let flagged = 0
  let voided = 0
  let survivorGraded = 0

  for (const game of ungraded) {
    if (game.canceled) {
      await db
        .update(picks)
        .set({ result: 'void', gradedAt: new Date() })
        .where(and(eq(picks.gameId, game.id), eq(picks.result, 'pending')))
      // A voided survivor pick survives and frees the team + week slot for a re-pick.
      await db
        .update(survivorPicks)
        .set({ result: 'void', gradedAt: new Date() })
        .where(and(eq(survivorPicks.gameId, game.id), eq(survivorPicks.result, 'pending')))
      await db.update(games).set({ gradedAt: new Date() }).where(eq(games.id, game.id))
      voided++
      continue
    }

    if (!game.completed) continue

    if (game.homeScore === null || game.awayScore === null) {
      await db.update(games).set({ needsReview: true }).where(eq(games.id, game.id))
      flagged++
      continue
    }

    const gamePicks = await db
      .select()
      .from(picks)
      .where(and(eq(picks.gameId, game.id), eq(picks.result, 'pending')))

    for (const p of gamePicks) {
      const result = gradePick(
        p.side as 'home' | 'away',
        p.lockedSpread,
        game.homeScore,
        game.awayScore
      )
      await db
        .update(picks)
        .set({ result, gradedAt: new Date() })
        .where(eq(picks.id, p.id))
    }

    // Survivor picks on the same game grade straight-up (a tie is a loss).
    const gameSurvivorPicks = await db
      .select()
      .from(survivorPicks)
      .where(and(eq(survivorPicks.gameId, game.id), eq(survivorPicks.result, 'pending')))

    for (const p of gameSurvivorPicks) {
      const result = gradeSurvivorPick(
        p.side as 'home' | 'away',
        game.homeScore,
        game.awayScore
      )
      await db
        .update(survivorPicks)
        .set({ result, gradedAt: new Date() })
        .where(eq(survivorPicks.id, p.id))
      survivorGraded++
    }

    await db.update(games).set({ gradedAt: new Date() }).where(eq(games.id, game.id))
    gradedGames++
  }

  return { gradedGames, flagged, voided, survivorGraded }
}
