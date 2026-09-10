'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type React from 'react'
import { resolveSheetSwipe } from '@/lib/sheet-swipe'

/** Finger travel (px) before a touch is treated as a drag rather than a tap. */
const DRAG_SLOP = 4
/** If the finger paused this long (ms) before lifting, ignore its earlier speed. */
const STALE_VELOCITY_MS = 100

interface DragState {
  startY: number
  /** Sheet offset (px below expanded position) when the touch began. */
  startOffset: number
  lastY: number
  lastT: number
  /** Upward speed in px/ms from the most recent move. */
  velocity: number
  /** Set once the finger has moved past DRAG_SLOP. */
  active: boolean
}

/**
 * Drag-to-reveal mobile bottom sheet.
 *
 * The sheet always renders its full content and is pushed down with a
 * `translateY` so only the peek region (everything above `bodyRef`, including
 * the body's top margin) shows when collapsed. While dragging, the transform
 * follows the finger directly on the DOM (no React re-renders); on release the
 * CSS transition snaps it to the nearest state. `--sheet-p` on the root wrapper
 * tracks progress from 0 (collapsed) to 1 (expanded) so children can crossfade.
 */
export function useBottomSheet() {
  const [expanded, setExpanded] = useState(false)
  /** `display: contents` wrapper that carries `--sheet-p` and `data-dragging`. */
  const rootRef = useRef<HTMLDivElement>(null)
  /** The fixed, translated panel. */
  const sheetRef = useRef<HTMLDivElement>(null)
  /** Wrapper around the content that is hidden when collapsed. */
  const bodyRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef(false)
  const drag = useRef<DragState | null>(null)
  const mounted = useRef(false)

  /** How far (px) the sheet sits below its expanded position when collapsed. */
  const collapsedOffset = useCallback((): number => {
    const sheet = sheetRef.current
    const body = bodyRef.current
    if (!sheet || !body) return 0
    return Math.max(0, sheet.offsetHeight - body.offsetTop)
  }, [])

  /** Where the sheet currently is on screen, even mid-transition. */
  const currentOffset = useCallback((): number => {
    const sheet = sheetRef.current
    if (!sheet) return 0
    const t = getComputedStyle(sheet).transform
    return t && t !== 'none' ? new DOMMatrix(t).m42 : 0
  }, [])

  const paint = useCallback(
    (offset: number, animate: boolean) => {
      const root = rootRef.current
      const sheet = sheetRef.current
      if (!root || !sheet) return
      const max = collapsedOffset()
      const p = max > 0 ? Math.min(1, Math.max(0, 1 - offset / max)) : 1
      root.toggleAttribute('data-dragging', !animate)
      root.toggleAttribute('data-raised', p > 0)
      root.style.setProperty('--sheet-p', p.toFixed(4))
      sheet.style.transform = `translateY(${offset}px)`
    },
    [collapsedOffset],
  )

  const settle = useCallback(
    (open: boolean, animate: boolean) => {
      paint(open ? 0 : collapsedOffset(), animate)
      if (!animate) {
        // Commit the un-transitioned position, then re-enable transitions.
        void sheetRef.current?.offsetHeight
        rootRef.current?.removeAttribute('data-dragging')
      }
    },
    [collapsedOffset, paint],
  )

  useLayoutEffect(() => {
    expandedRef.current = expanded
    settle(expanded, mounted.current)
    mounted.current = true
  }, [expanded, settle])

  // Content can grow or shrink (picks added, messages shown, breakpoint
  // crossed); keep the resting position in step without animating.
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (!drag.current) settle(expandedRef.current, false)
    })
    ro.observe(sheet)
    return () => ro.disconnect()
  }, [settle])

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    drag.current = {
      startY: t.clientY,
      startOffset: currentOffset(),
      lastY: t.clientY,
      lastT: e.timeStamp,
      velocity: 0,
      active: false,
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    const d = drag.current
    const t = e.touches[0]
    if (!d || !t) return
    const dy = d.startY - t.clientY
    if (!d.active && Math.abs(dy) < DRAG_SLOP) return
    d.active = true
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.velocity = (d.lastY - t.clientY) / dt
    d.lastY = t.clientY
    d.lastT = e.timeStamp
    const max = collapsedOffset()
    paint(Math.min(max, Math.max(0, d.startOffset - dy)), false)
  }

  function onTouchEnd(e: React.TouchEvent) {
    const d = drag.current
    drag.current = null
    if (!d) return
    const t = e.changedTouches[0]
    const dy = d.active && t ? d.startY - t.clientY : 0
    const velocity = e.timeStamp - d.lastT > STALE_VELOCITY_MS ? 0 : d.velocity
    const next = resolveSheetSwipe(expandedRef.current, dy, velocity)
    settle(next, true)
    setExpanded(next)
  }

  return {
    expanded,
    setExpanded,
    rootRef,
    sheetRef,
    bodyRef,
    sheetHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  }
}
