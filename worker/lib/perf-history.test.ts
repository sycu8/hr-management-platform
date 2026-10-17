import { describe, expect, it } from 'vitest'
import {
  chartCycleLabel,
  computeTrend,
  isLowScore,
  pickScore,
  shortCycleLabel,
} from './perf-history.ts'

describe('shortCycleLabel', () => {
  it('shortens Vietnamese cycle names', () => {
    expect(shortCycleLabel('Đánh giá năm 2025')).toBe('NĂM 2025')
    expect(shortCycleLabel('Đánh giá giữa năm 2026')).toBe('GIỮA NĂM 2026')
    expect(shortCycleLabel('Đánh giá cuối năm 2026')).toBe('CUỐI NĂM 2026')
    expect(chartCycleLabel('Đánh giá giữa năm 2026')).toBe('giữa năm 2026')
  })
})

describe('computeTrend', () => {
  it('marks insufficient with <2 scores', () => {
    expect(computeTrend([null, null]).kind).toBe('insufficient')
    expect(computeTrend([4.0, null]).kind).toBe('insufficient')
    expect(computeTrend([null, 4.0]).label).toBe('Chưa đủ dữ liệu')
  })

  it('detects up / down / stable', () => {
    expect(computeTrend([3.9, 4.1])).toEqual({
      kind: 'up',
      delta: 0.2,
      label: 'Tăng 0,2',
    })
    expect(computeTrend([4.1, 4.0])).toEqual({
      kind: 'down',
      delta: -0.1,
      label: 'Giảm 0,1',
    })
    expect(computeTrend([4.0, 4.0]).kind).toBe('stable')
    expect(computeTrend([4.0, 4.0]).label).toBe('Ổn định')
  })

  it('uses the last two non-null scores', () => {
    expect(computeTrend([3.0, null, 3.5]).label).toBe('Tăng 0,5')
  })
})

describe('score helpers', () => {
  it('flags low scores at ≤ 3.4', () => {
    expect(isLowScore(3.4)).toBe(true)
    expect(isLowScore(3.2)).toBe(true)
    expect(isLowScore(3.5)).toBe(false)
  })

  it('picks final then manager then self', () => {
    expect(pickScore(4.0, 4.1, 3.9)).toBe(4.0)
    expect(pickScore(null, 4.1, 3.9)).toBe(4.1)
    expect(pickScore(null, null, 3.9)).toBe(3.9)
    expect(pickScore(null, null, null)).toBe(null)
  })
})
