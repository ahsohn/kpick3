import { describe, expect, it } from 'vitest'
import { needsReviewEmail, recapEmail, reminderEmail } from '../lib/notify/emails'

const unsubscribeUrl = 'https://kpick3.com/api/unsubscribe?token=tok'

describe('reminderEmail', () => {
  const base = {
    displayName: 'Alex',
    window: 'sat' as const,
    week: 3,
    pick3: { pickCount: 1, nextKickoff: new Date('2026-09-20T17:00:00Z') },
    survivor: { remainingPickable: 8 },
    unsubscribeUrl,
  }

  it('mentions the week, both pools, and the unsubscribe link', () => {
    const { subject, html, text } = reminderEmail(base)
    expect(subject).toContain('Week 3')
    expect(html).toContain('1/3')
    expect(html).toContain('survivor')
    expect(html).toContain(unsubscribeUrl)
    expect(text).toContain(unsubscribeUrl)
  })

  it('marks the Sunday email as last call and omits absent pools', () => {
    const sun = reminderEmail({ ...base, window: 'sun', survivor: null })
    expect(sun.subject.toLowerCase()).toContain('last call')
    expect(sun.html).not.toContain('survivor')
  })

  it('escapes HTML in display names', () => {
    const evil = reminderEmail({ ...base, displayName: '<b>x</b>' })
    expect(evil.html).not.toContain('<b>x</b>')
    expect(evil.html).toContain('&lt;b&gt;')
  })
})

describe('recapEmail', () => {
  it('shows picks, points, standings and survivor news', () => {
    const { subject, html, text } = recapEmail({
      displayName: 'Alex',
      week: 3,
      myPicks: [
        { label: 'KC −3.5 vs LAC', result: 'win' },
        { label: 'BUF +2.5 @ NYJ', result: 'loss' },
        { label: 'DAL −1.0 vs PHI', result: 'push' },
      ],
      weekPoints: 1,
      parlay: false,
      standings: [
        { displayName: 'Sam', points: 10, isYou: false },
        { displayName: 'Alex', points: 8, isYou: true },
      ],
      survivorEliminated: ['Pat'],
      survivorChampions: [],
      unsubscribeUrl,
    })
    expect(subject).toContain('Week 3')
    expect(html).toContain('KC −3.5 vs LAC')
    expect(html).toContain('Pat')
    expect(html).toContain(unsubscribeUrl)
    expect(text).toContain('1 point')
  })
})

describe('needsReviewEmail', () => {
  it('lists the flagged games and links to /admin', () => {
    const { subject, html } = needsReviewEmail([
      { week: 3, awayTeamAbbr: 'LAC', homeTeamAbbr: 'KC' },
    ])
    expect(subject).toContain('review')
    expect(html).toContain('LAC @ KC')
    expect(html).toContain('/admin')
  })
})
