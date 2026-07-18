export type SurvivorResult = 'pending' | 'win' | 'loss' | 'void'

/** Straight-up grading. A tie is a loss — survivor has no push. */
export function gradeSurvivorPick(
  side: 'home' | 'away',
  homeScore: number,
  awayScore: number
): 'win' | 'loss' {
  const picked = side === 'home' ? homeScore : awayScore
  const other = side === 'home' ? awayScore : homeScore
  return picked > other ? 'win' : 'loss'
}

/**
 * Per-week schedule facts the status derivation needs. `lastKickoff` is the latest
 * kickoff among the week's non-canceled games — once it passes, a pickless player has
 * nothing left to pick. Weeks whose games are all canceled should be omitted entirely
 * (they can eliminate no one).
 */
export interface SurvivorWeekInfo {
  week: number
  lastKickoff: Date
  /** Every non-canceled game graded — used only for champion detection. */
  fullyGraded: boolean
}

export interface SurvivorPickInput {
  week: number
  result: SurvivorResult
}

export interface SurvivorStatus {
  alive: boolean
  eliminatedWeek: number | null
  eliminatedReason: 'loss' | 'missed' | null
}

/**
 * Derives one player's alive/eliminated status from their season of picks — nothing is
 * stored that can drift stale. Walks weeks in ascending order:
 *   - a graded loss                          → eliminated there
 *   - a win, or only void picks              → survives, keep walking
 *   - a pending pick                         → undecided; stop (alive so far)
 *   - no pick and the last kickoff passed    → eliminated there (missed week)
 *   - no pick and games remain pickable      → undecided; stop (can still pick)
 */
export function computeSurvivorStatus(
  picks: SurvivorPickInput[],
  weeks: SurvivorWeekInfo[],
  now: Date
): SurvivorStatus {
  const byWeek = new Map<number, SurvivorPickInput[]>()
  for (const p of picks) {
    if (!byWeek.has(p.week)) byWeek.set(p.week, [])
    byWeek.get(p.week)!.push(p)
  }

  for (const w of weeks) {
    const weekPicks = byWeek.get(w.week) ?? []
    if (weekPicks.some((p) => p.result === 'loss')) {
      return { alive: false, eliminatedWeek: w.week, eliminatedReason: 'loss' }
    }
    if (weekPicks.some((p) => p.result === 'win')) continue
    if (weekPicks.some((p) => p.result === 'pending')) {
      return { alive: true, eliminatedWeek: null, eliminatedReason: null }
    }
    // Only void picks (canceled game) — survives without burning the week.
    if (weekPicks.length > 0) continue
    if (now >= w.lastKickoff) {
      return { alive: false, eliminatedWeek: w.week, eliminatedReason: 'missed' }
    }
    return { alive: true, eliminatedWeek: null, eliminatedReason: null }
  }

  return { alive: true, eliminatedWeek: null, eliminatedReason: null }
}

export interface ChampionOutcome {
  over: boolean
  /** One id = champion; several = co-champions; empty = pool still running. */
  championUserIds: number[]
  decidedWeek: number | null
}

/**
 * Champion detection, deliberately more conservative than per-player status: only weeks
 * where every game is graded count as decided, so a loss graded on Thursday can never
 * crown a champion that Sunday's results would un-crown. Walks decided weeks in order:
 * the pool ends the first week after which one player remains (champion) or none remain
 * (that week's casualties are co-champions). If the season ends with 2+ alive, they're
 * all co-champions.
 */
export function computeChampions(
  statuses: Map<number, SurvivorStatus>,
  weeks: SurvivorWeekInfo[]
): ChampionOutcome {
  const entrants = [...statuses.keys()]
  if (entrants.length === 0) return { over: false, championUserIds: [], decidedWeek: null }

  for (const w of weeks) {
    if (!w.fullyGraded) break
    const alive = entrants.filter((id) => {
      const s = statuses.get(id)!
      return s.alive || s.eliminatedWeek! > w.week
    })
    if (alive.length === 1) {
      return { over: true, championUserIds: alive, decidedWeek: w.week }
    }
    if (alive.length === 0) {
      const casualties = entrants.filter((id) => statuses.get(id)!.eliminatedWeek === w.week)
      return { over: true, championUserIds: casualties, decidedWeek: w.week }
    }
  }

  const lastWeek = weeks[weeks.length - 1]
  if (lastWeek && weeks.every((w) => w.fullyGraded)) {
    const alive = entrants.filter((id) => statuses.get(id)!.alive)
    if (alive.length >= 2) {
      return { over: true, championUserIds: alive, decidedWeek: lastWeek.week }
    }
  }

  return { over: false, championUserIds: [], decidedWeek: null }
}
