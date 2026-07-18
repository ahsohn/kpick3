import { describe, it, expect } from 'vitest'
import {
  gradeSurvivorPick,
  computeSurvivorStatus,
  computeChampions,
  type SurvivorPickInput,
  type SurvivorStatus,
  type SurvivorWeekInfo,
} from '@/lib/survivor/logic'

describe('gradeSurvivorPick', () => {
  it('home team wins straight-up', () => {
    expect(gradeSurvivorPick('home', 27, 20)).toBe('win')
    expect(gradeSurvivorPick('away', 27, 20)).toBe('loss')
  })

  it('away team wins straight-up', () => {
    expect(gradeSurvivorPick('away', 17, 24)).toBe('win')
    expect(gradeSurvivorPick('home', 17, 24)).toBe('loss')
  })

  it('a tie is a loss for both sides', () => {
    expect(gradeSurvivorPick('home', 20, 20)).toBe('loss')
    expect(gradeSurvivorPick('away', 20, 20)).toBe('loss')
  })
})

// Helpers: a season where week N's games all kick off on day N and grade by day N+1.
const day = (n: number) => new Date(Date.UTC(2026, 8, 1, 17, 0, 0) + n * 86_400_000)
const week = (n: number, fullyGraded: boolean): SurvivorWeekInfo => ({
  week: n,
  lastKickoff: day(n),
  fullyGraded,
})
const pick = (w: number, result: SurvivorPickInput['result']): SurvivorPickInput => ({
  week: w,
  result,
})

describe('computeSurvivorStatus', () => {
  const threeWeeks = [week(1, true), week(2, true), week(3, false)]

  it('all wins → alive', () => {
    const s = computeSurvivorStatus([pick(1, 'win'), pick(2, 'win')], threeWeeks, day(2.5))
    expect(s).toEqual({ alive: true, eliminatedWeek: null, eliminatedReason: null })
  })

  it('a graded loss eliminates in that week', () => {
    const s = computeSurvivorStatus([pick(1, 'win'), pick(2, 'loss')], threeWeeks, day(3))
    expect(s).toEqual({ alive: false, eliminatedWeek: 2, eliminatedReason: 'loss' })
  })

  it('earliest elimination wins when multiple bad weeks exist', () => {
    const s = computeSurvivorStatus([pick(2, 'loss')], threeWeeks, day(5))
    // No pick in week 1 and its last kickoff passed — that miss comes first.
    expect(s).toEqual({ alive: false, eliminatedWeek: 1, eliminatedReason: 'missed' })
  })

  it('no pick after the last kickoff → missed week elimination', () => {
    const s = computeSurvivorStatus([pick(1, 'win')], threeWeeks, day(2.5))
    expect(s).toEqual({ alive: false, eliminatedWeek: 2, eliminatedReason: 'missed' })
  })

  it('no pick before the last kickoff → still alive (can still pick)', () => {
    const s = computeSurvivorStatus([pick(1, 'win')], threeWeeks, day(1.5))
    expect(s).toEqual({ alive: true, eliminatedWeek: null, eliminatedReason: null })
  })

  it('pending pick → undecided, alive', () => {
    const s = computeSurvivorStatus([pick(1, 'pending')], threeWeeks, day(1.5))
    expect(s.alive).toBe(true)
  })

  it('void-only week survives without burning the week', () => {
    const s = computeSurvivorStatus(
      [pick(1, 'void'), pick(2, 'win')],
      threeWeeks,
      day(2.5)
    )
    expect(s.alive).toBe(true)
  })

  it('void plus a replacement pick uses the replacement result', () => {
    const out = computeSurvivorStatus(
      [pick(1, 'void'), pick(1, 'loss')],
      threeWeeks,
      day(2)
    )
    expect(out).toEqual({ alive: false, eliminatedWeek: 1, eliminatedReason: 'loss' })

    const on = computeSurvivorStatus(
      [pick(1, 'void'), pick(1, 'win')],
      threeWeeks,
      day(1.5)
    )
    expect(on.alive).toBe(true)
  })

  it('void-only final decided week does not count as missed', () => {
    const s = computeSurvivorStatus([pick(1, 'void')], [week(1, true)], day(5))
    expect(s.alive).toBe(true)
  })
})

describe('computeChampions', () => {
  const statuses = (entries: [number, SurvivorStatus][]) => new Map(entries)
  const alive: SurvivorStatus = { alive: true, eliminatedWeek: null, eliminatedReason: null }
  const outIn = (w: number): SurvivorStatus => ({
    alive: false,
    eliminatedWeek: w,
    eliminatedReason: 'loss',
  })

  it('pool still running mid-season with several alive', () => {
    const r = computeChampions(
      statuses([[1, alive], [2, alive], [3, outIn(2)]]),
      [week(1, true), week(2, true), week(3, false)]
    )
    expect(r.over).toBe(false)
  })

  it('one player left after a fully graded week → champion', () => {
    const r = computeChampions(
      statuses([[1, alive], [2, outIn(3)], [3, outIn(2)]]),
      [week(1, true), week(2, true), week(3, true), week(4, false)]
    )
    expect(r).toEqual({ over: true, championUserIds: [1], decidedWeek: 3 })
  })

  it('last two lose the same week → co-champions', () => {
    const r = computeChampions(
      statuses([[1, outIn(4)], [2, outIn(4)], [3, outIn(2)]]),
      [week(1, true), week(2, true), week(3, true), week(4, true)]
    )
    expect(r.over).toBe(true)
    expect(r.championUserIds.sort()).toEqual([1, 2])
    expect(r.decidedWeek).toBe(4)
  })

  it('does not fire prematurely when the deciding week is not fully graded', () => {
    // Two left; player 2's Thursday loss is graded but Sunday games are pending.
    const r = computeChampions(
      statuses([[1, alive], [2, outIn(4)]]),
      [week(1, true), week(2, true), week(3, true), week(4, false)]
    )
    expect(r.over).toBe(false)
    expect(r.championUserIds).toEqual([])
  })

  it('season ends fully graded with 2+ alive → all co-champions', () => {
    const r = computeChampions(
      statuses([[1, alive], [2, alive], [3, outIn(1)]]),
      [week(1, true), week(2, true)]
    )
    expect(r.over).toBe(true)
    expect(r.championUserIds.sort()).toEqual([1, 2])
    expect(r.decidedWeek).toBe(2)
  })

  it('no entrants → not over', () => {
    const r = computeChampions(new Map(), [week(1, true)])
    expect(r.over).toBe(false)
  })
})
