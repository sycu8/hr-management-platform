import { describe, expect, it } from 'vitest'
import {
  CYCLE_STATUS_LABEL,
  cycleStatusLabel,
  deriveFinalScore,
  isCycleStatus,
  isRatingComplete,
  progressPct,
} from './cycles.ts'

describe('cycle status labels', () => {
  it('maps planned/open/closed to Vietnamese', () => {
    expect(CYCLE_STATUS_LABEL.planned).toBe('Sắp mở')
    expect(CYCLE_STATUS_LABEL.open).toBe('Đang mở')
    expect(CYCLE_STATUS_LABEL.closed).toBe('Đã đóng')
    expect(cycleStatusLabel('planned')).toBe('Sắp mở')
    expect(isCycleStatus('open')).toBe(true)
    expect(isCycleStatus('draft')).toBe(false)
  })
})

describe('deriveFinalScore', () => {
  it('prefers explicit final', () => {
    expect(deriveFinalScore(4, 5, 4.2)).toBe(4.2)
  })

  it('averages self + manager when final omitted', () => {
    expect(deriveFinalScore(4, 5, null)).toBe(4.5)
    expect(deriveFinalScore(3.9, 4.1, undefined)).toBe(4)
  })

  it('returns null when incomplete', () => {
    expect(deriveFinalScore(4, null, null)).toBeNull()
    expect(deriveFinalScore(null, 4, null)).toBeNull()
  })
})

describe('progress helpers', () => {
  it('computes pct and completeness', () => {
    expect(progressPct(10, 15)).toBe(67)
    expect(progressPct(0, 0)).toBe(0)
    expect(isRatingComplete(4)).toBe(true)
    expect(isRatingComplete(null)).toBe(false)
  })
})
