import { formatSpread } from '@/lib/format'

export interface LockedLineNote {
  /** True when the locked line differs from the one the player picked at. */
  moved: boolean
  text: string
}

/**
 * Slip note for a pick whose line has locked but whose game hasn't kicked off: tells
 * the player the number they picked at and the number they're now graded on, so they
 * can decide whether to keep the pick. Null for legacy picks with no recorded
 * picked-at spread.
 */
export function lockedLineNote(pickedSpread: number | null, lockedSpread: number): LockedLineNote | null {
  if (pickedSpread === null) return null
  if (pickedSpread === lockedSpread) {
    return { moved: false, text: `Line locked at ${formatSpread(lockedSpread)} — the line you picked` }
  }
  return {
    moved: true,
    text: `Line moved — you picked at ${formatSpread(pickedSpread)}, locked at ${formatSpread(lockedSpread)}`,
  }
}
