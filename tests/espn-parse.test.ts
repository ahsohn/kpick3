import { describe, expect, it } from 'vitest'
import { parseHomeSpread, parseEvent, isRegularSeason, nflSeasonYear } from '@/lib/espn/parse'

describe('parseHomeSpread', () => {
  it('prefers the numeric spread field (home-relative)', () => {
    expect(parseHomeSpread({ spread: -3.5, details: 'KC -3.5' }, 'KC', 'LAC')).toBe(-3.5)
    expect(parseHomeSpread({ spread: 7, details: 'BUF -7' }, 'NYJ', 'BUF')).toBe(7)
  })
  it('falls back to parsing details against the home abbreviation', () => {
    expect(parseHomeSpread({ details: 'KC -3.5' }, 'KC', 'LAC')).toBe(-3.5)
  })
  it('negates when the favorite in details is the away team', () => {
    expect(parseHomeSpread({ details: 'KC -3.5' }, 'LAC', 'KC')).toBe(3.5)
  })
  it('treats EVEN as 0', () => {
    expect(parseHomeSpread({ details: 'EVEN' }, 'KC', 'LAC')).toBe(0)
  })
  it('returns null for missing or unparseable odds', () => {
    expect(parseHomeSpread(null, 'KC', 'LAC')).toBeNull()
    expect(parseHomeSpread({}, 'KC', 'LAC')).toBeNull()
    expect(parseHomeSpread({ details: 'garbage' }, 'KC', 'LAC')).toBeNull()
    expect(parseHomeSpread({ details: 'SF -2.5' }, 'KC', 'LAC')).toBeNull()
  })
})

function makeEvent(overrides: any = {}) {
  return {
    id: 401671001,
    date: '2026-09-13T17:00Z',
    season: { year: 2026, type: 2 },
    week: { number: 1 },
    competitions: [
      {
        status: {
          period: 0,
          displayClock: '0:00',
          type: { state: 'pre', name: 'STATUS_SCHEDULED', completed: false, detail: 'Sun, September 13th at 1:00 PM EDT' },
        },
        competitors: [
          {
            homeAway: 'home',
            score: '0',
            team: { displayName: 'Kansas City Chiefs', abbreviation: 'KC', logo: 'https://a.espncdn.com/kc.png' },
          },
          {
            homeAway: 'away',
            score: '0',
            team: { displayName: 'Los Angeles Chargers', abbreviation: 'LAC', logo: 'https://a.espncdn.com/lac.png' },
          },
        ],
        odds: [{ details: 'KC -3.5', overUnder: 46.5, spread: -3.5 }],
        ...overrides.competition,
      },
    ],
    ...overrides.event,
  }
}

describe('parseEvent', () => {
  it('parses a scheduled regular-season game', () => {
    const g = parseEvent(makeEvent())
    expect(g.espnId).toBe('401671001')
    expect(g.season).toBe(2026)
    expect(g.week).toBe(1)
    expect(g.statusState).toBe('pre')
    expect(g.completed).toBe(false)
    expect(g.canceled).toBe(false)
    expect(g.homeTeamAbbr).toBe('KC')
    expect(g.awayTeamAbbr).toBe('LAC')
    expect(g.homeSpread).toBe(-3.5)
    expect(g.kickoff.toISOString()).toBe('2026-09-13T17:00:00.000Z')
  })

  it('parses a final with scores', () => {
    const g = parseEvent(
      makeEvent({
        competition: {
          status: { period: 4, displayClock: '0:00', type: { state: 'post', name: 'STATUS_FINAL', completed: true, detail: 'Final' } },
          competitors: [
            { homeAway: 'home', score: '27', team: { displayName: 'Kansas City Chiefs', abbreviation: 'KC', logo: '' } },
            { homeAway: 'away', score: '20', team: { displayName: 'Los Angeles Chargers', abbreviation: 'LAC', logo: '' } },
          ],
          odds: undefined,
        },
      })
    )
    expect(g.completed).toBe(true)
    expect(g.homeScore).toBe(27)
    expect(g.awayScore).toBe(20)
    expect(g.homeSpread).toBeNull()
  })

  it('flags canceled games', () => {
    const g = parseEvent(
      makeEvent({
        competition: {
          status: { type: { state: 'post', name: 'STATUS_CANCELED', completed: false, detail: 'Canceled' } },
          competitors: [
            { homeAway: 'home', score: '', team: { displayName: 'Kansas City Chiefs', abbreviation: 'KC', logo: '' } },
            { homeAway: 'away', score: '', team: { displayName: 'Los Angeles Chargers', abbreviation: 'LAC', logo: '' } },
          ],
        },
      })
    )
    expect(g.canceled).toBe(true)
    expect(g.completed).toBe(false)
    expect(g.homeScore).toBeNull()
  })
})

describe('nflSeasonYear', () => {
  it('maps Sep–Dec to the same year', () => {
    expect(nflSeasonYear(new Date('2026-09-10T00:00:00Z'))).toBe(2026)
    expect(nflSeasonYear(new Date('2026-12-28T00:00:00Z'))).toBe(2026)
  })
  it('maps Jan–Feb (playoffs) to the previous year', () => {
    expect(nflSeasonYear(new Date('2027-01-15T00:00:00Z'))).toBe(2026)
    expect(nflSeasonYear(new Date('2027-02-10T00:00:00Z'))).toBe(2026)
  })
  it('maps the offseason (Mar–Aug) to the upcoming season', () => {
    expect(nflSeasonYear(new Date('2026-07-15T00:00:00Z'))).toBe(2026)
    expect(nflSeasonYear(new Date('2026-03-01T00:00:00Z'))).toBe(2026)
  })
})

describe('isRegularSeason', () => {
  it('accepts season type 2 and rejects pre/postseason', () => {
    expect(isRegularSeason({ season: { type: 2 } })).toBe(true)
    expect(isRegularSeason({ season: { type: 1 } })).toBe(false)
    expect(isRegularSeason({ season: { type: 3 } })).toBe(false)
    expect(isRegularSeason({})).toBe(false)
  })
})
