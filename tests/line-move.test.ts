import { describe, expect, it } from 'vitest'
import { lockedLineNote } from '@/lib/picks/line-move'

describe('lockedLineNote', () => {
  it('reports both numbers when the line moved', () => {
    expect(lockedLineNote(-3.5, -4.5)).toEqual({
      moved: true,
      text: 'Line moved — you picked at -3.5, locked at -4.5',
    })
  })
  it('confirms the number when the line held', () => {
    expect(lockedLineNote(3, 3)).toEqual({ moved: false, text: 'Line locked at +3 — the line you picked' })
  })
  it('formats a pick-em line', () => {
    expect(lockedLineNote(-1, 0)?.text).toBe('Line moved — you picked at -1, locked at PK')
  })
  it('returns null for picks made before the picked-at spread was recorded', () => {
    expect(lockedLineNote(null, -3)).toBeNull()
  })
})
