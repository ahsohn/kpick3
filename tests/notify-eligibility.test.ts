import { describe, expect, it } from 'vitest'
import {
  needsPick3Reminder,
  needsSurvivorReminder,
  pickableGames,
  weekFullyGraded,
  type RecapGame,
  type ReminderGame,
} from '../lib/notify/eligibility'

const now = new Date('2026-09-13T14:00:00Z')
const future = new Date('2026-09-13T17:00:00Z')
const past = new Date('2026-09-13T00:20:00Z')

function game(overrides: Partial<ReminderGame> = {}): ReminderGame {
  return {
    kickoff: future,
    statusState: 'pre',
    canceled: false,
    homeTeamAbbr: 'KC',
    awayTeamAbbr: 'LAC',
    ...overrides,
  }
}

describe('pickableGames', () => {
  it('keeps only future, pre-status, non-canceled games', () => {
    const games = [
      game(),
      game({ kickoff: past }),
      game({ statusState: 'in' }),
      game({ canceled: true }),
    ]
    expect(pickableGames(games, now)).toHaveLength(1)
  })
})

describe('needsPick3Reminder', () => {
  it('reminds a player with 0, 1 or 2 picks while games remain', () => {
    expect(needsPick3Reminder(0, [game()], now)).toBe(true)
    expect(needsPick3Reminder(2, [game()], now)).toBe(true)
  })

  it('does not remind with 3 picks in', () => {
    expect(needsPick3Reminder(3, [game()], now)).toBe(false)
  })

  it('does not remind when nothing is pickable', () => {
    expect(needsPick3Reminder(0, [game({ kickoff: past })], now)).toBe(false)
  })
})

describe('needsSurvivorReminder', () => {
  const base = { enrolled: true, alive: true, hasPickThisWeek: false, usedTeams: new Set<string>() }

  it('reminds an alive, enrolled, pickless player with a usable game', () => {
    expect(needsSurvivorReminder(base, [game()], now)).toBe(true)
  })

  it('skips non-enrolled, eliminated, and already-picked players', () => {
    expect(needsSurvivorReminder({ ...base, enrolled: false }, [game()], now)).toBe(false)
    expect(needsSurvivorReminder({ ...base, alive: false }, [game()], now)).toBe(false)
    expect(needsSurvivorReminder({ ...base, hasPickThisWeek: true }, [game()], now)).toBe(false)
  })

  it('skips when both sides of every pickable game are already used', () => {
    const used = { ...base, usedTeams: new Set(['KC', 'LAC']) }
    expect(needsSurvivorReminder(used, [game()], now)).toBe(false)
    // One free side is enough.
    expect(needsSurvivorReminder({ ...base, usedTeams: new Set(['KC']) }, [game()], now)).toBe(true)
  })
})

describe('weekFullyGraded', () => {
  const graded: RecapGame = { completed: true, canceled: false, gradedAt: now, needsReview: false }

  it('is true when every game is graded and none flagged', () => {
    expect(weekFullyGraded([graded, graded])).toBe(true)
  })

  it('is false with an ungraded or flagged game', () => {
    expect(weekFullyGraded([graded, { ...graded, gradedAt: null }])).toBe(false)
    expect(weekFullyGraded([graded, { ...graded, needsReview: true, gradedAt: null }])).toBe(false)
  })

  it('tolerates canceled games (graded as void) but requires a real finished game', () => {
    const canceledVoided: RecapGame = { completed: false, canceled: true, gradedAt: now, needsReview: false }
    expect(weekFullyGraded([graded, canceledVoided])).toBe(true)
    expect(weekFullyGraded([canceledVoided])).toBe(false)
    expect(weekFullyGraded([])).toBe(false)
  })
})
