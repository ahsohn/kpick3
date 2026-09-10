import { describe, expect, it } from 'vitest'
import { resolveSheetSwipe } from '@/lib/sheet-swipe'

describe('resolveSheetSwipe', () => {
  it('expands on a long upward swipe', () => {
    expect(resolveSheetSwipe(false, 60, 0)).toBe(true)
  })
  it('collapses on a long downward swipe', () => {
    expect(resolveSheetSwipe(true, -60, 0)).toBe(false)
  })
  it('snaps back when the drag is short and slow', () => {
    expect(resolveSheetSwipe(false, 20, 0.1)).toBe(false)
    expect(resolveSheetSwipe(true, -20, -0.1)).toBe(true)
  })
  it('treats a tap as no change', () => {
    expect(resolveSheetSwipe(false, 0, 0)).toBe(false)
    expect(resolveSheetSwipe(true, 0, 0)).toBe(true)
  })
  it('lets a quick flick win over a short distance', () => {
    expect(resolveSheetSwipe(false, 10, 1.2)).toBe(true)
    expect(resolveSheetSwipe(true, -10, -1.2)).toBe(false)
  })
  it('lets the final flick direction override earlier travel', () => {
    // dragged the sheet most of the way down, then flicked it back up
    expect(resolveSheetSwipe(true, -120, 0.9)).toBe(true)
  })
})
