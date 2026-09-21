import type { PickResult } from './grading'

/** Hypothetical flat stake per pick for the "if everyone bet $100" line. */
export const STAKE = 100
/** Standard -110 juice: risk $110 to win $100, so a $100 stake returns $90.91. */
export const WIN_PAYOUT = STAKE / 1.1

export interface WeekSummary {
  wins: number
  losses: number
  pushes: number
  pending: number
  /** Picks with a final result (win/loss/push). Voids don't count. */
  graded: number
  /** Net profit or loss at STAKE per pick. Pushes and voids are money back. */
  dollars: number
}

/** Combined record across every pick in a week, plus the flat-stake dollar outcome. */
export function summarizeWeek(results: PickResult[]): WeekSummary {
  const count = (r: PickResult) => results.filter((x) => x === r).length
  const wins = count('win')
  const losses = count('loss')
  const pushes = count('push')
  return {
    wins,
    losses,
    pushes,
    pending: count('pending'),
    graded: wins + losses + pushes,
    dollars: wins * WIN_PAYOUT - losses * STAKE,
  }
}

/** "+$373", "-$1,200", "$0" — whole dollars, explicit sign on non-zero amounts. */
export function formatDollars(amount: number): string {
  const rounded = Math.round(amount)
  if (rounded === 0) return '$0'
  const abs = Math.abs(rounded).toLocaleString('en-US')
  return `${rounded > 0 ? '+' : '-'}$${abs}`
}
