import {
  pgTable, serial, text, integer, boolean, timestamp, real, index, uniqueIndex,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  // Salted scrypt hash ("salt:hash" hex). Only set for the super admin; everyone else
  // signs in with email alone.
  pinHash: text('pin_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  espnId: text('espn_id').notNull().unique(),
  season: integer('season').notNull(),            // e.g. 2026
  week: integer('week').notNull(),                // 1–18 (regular season only)
  kickoff: timestamp('kickoff', { withTimezone: true }).notNull(),
  statusState: text('status_state').notNull(),    // 'pre' | 'in' | 'post'
  statusDetail: text('status_detail'),            // e.g. 'Final', 'STATUS_POSTPONED'
  completed: boolean('completed').notNull().default(false),
  canceled: boolean('canceled').notNull().default(false),
  homeTeamName: text('home_team_name').notNull(),
  homeTeamAbbr: text('home_team_abbr').notNull(),
  homeTeamLogo: text('home_team_logo').notNull(),
  awayTeamName: text('away_team_name').notNull(),
  awayTeamAbbr: text('away_team_abbr').notNull(),
  awayTeamLogo: text('away_team_logo').notNull(),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  period: integer('period'),                      // quarter while in progress
  displayClock: text('display_clock'),
  // Current line, refreshed by the cron until kickoff. Home-relative: negative means
  // the home team is favored (e.g. -3.5). Picks copy their own locked value.
  homeSpread: real('home_spread'),
  spreadDetails: text('spread_details'),          // ESPN's display string, e.g. "KC -3.5"
  oddsAvailable: boolean('odds_available').notNull().default(false),
  // Set when a final looked wrong (missing scores etc.) — surfaces in /admin.
  needsReview: boolean('needs_review').notNull().default(false),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byWeek: index('games_season_week_idx').on(t.season, t.week),
}))

export const picks = pgTable('picks', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  gameId: integer('game_id').notNull().references(() => games.id),
  season: integer('season').notNull(),
  week: integer('week').notNull(),
  side: text('side').notNull(),                   // 'home' | 'away'
  // Spread for the picked team at submission time (points added to their score);
  // +3.5 = underdog, -3.5 = favorite. This is what the pick is graded against, forever.
  lockedSpread: real('locked_spread').notNull(),
  result: text('result').notNull().default('pending'), // pending|win|loss|push|void
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  gradedAt: timestamp('graded_at', { withTimezone: true }),
}, (t) => ({
  oneSidePerGame: uniqueIndex('picks_user_game_uq').on(t.userId, t.gameId),
  byUserWeek: index('picks_user_week_idx').on(t.userId, t.season, t.week),
  byGame: index('picks_game_idx').on(t.gameId),
}))

export type User = typeof users.$inferSelect
export type Game = typeof games.$inferSelect
export type Pick = typeof picks.$inferSelect
