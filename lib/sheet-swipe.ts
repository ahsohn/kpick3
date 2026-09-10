/** Minimum vertical travel (px) for a touch to count as a swipe on the mobile sheet. */
export const SWIPE_THRESHOLD = 40
/** Upward speed (px/ms) above which a short swipe still counts as a flick. */
export const FLICK_VELOCITY = 0.5

/**
 * Decide whether the mobile sheet should end up expanded when a touch ends.
 *
 * `dy` is how far the finger travelled upward (negative = downward) and
 * `velocity` is its final upward speed. A quick flick wins in its direction,
 * then a swipe past the distance threshold, otherwise the sheet returns to
 * the state it started in.
 */
export function resolveSheetSwipe(expanded: boolean, dy: number, velocity: number): boolean {
  if (velocity > FLICK_VELOCITY) return true
  if (velocity < -FLICK_VELOCITY) return false
  if (dy > SWIPE_THRESHOLD) return true
  if (dy < -SWIPE_THRESHOLD) return false
  return expanded
}
