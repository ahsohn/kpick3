import { describe, expect, it } from 'vitest'
import { pickFinalEvents } from '@/lib/espn/settle'

function event(id: string, state: string, seasonType = 2, name = 'STATUS_FINAL') {
  return {
    id,
    season: { type: seasonType },
    competitions: [{ status: { type: { state, name } } }],
  }
}

describe('pickFinalEvents', () => {
  it('keeps only regular-season events that have gone final', () => {
    const events = [
      event('1', 'pre'),
      event('2', 'in'),
      event('3', 'post'),
      event('4', 'post', 1),
    ]
    expect(pickFinalEvents(events).map((e) => e.id)).toEqual(['3'])
  })

  it('keeps canceled games so their picks can be voided', () => {
    const events = [event('5', 'pre', 2, 'STATUS_CANCELED'), event('6', 'pre', 2, 'STATUS_POSTPONED')]
    expect(pickFinalEvents(events).map((e) => e.id)).toEqual(['5'])
  })

  it('handles a missing events list', () => {
    expect(pickFinalEvents(undefined)).toEqual([])
  })
})
