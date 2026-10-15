import { describe, expect, it } from 'vitest'
import {
  assessCompleteness,
  parseKeyResults,
  parsePeriod,
} from './okr.ts'

describe('okr period parse', () => {
  it('parses Q / H / Vietnamese', () => {
    expect(parsePeriod('2026-Q3')).toEqual({
      year: 2026,
      quarters: [3],
      label: 'Q3/2026',
      raw: '2026-Q3',
    })
    expect(parsePeriod('2026-H2')?.quarters).toEqual([3, 4])
    expect(parsePeriod('Quý 4/2026')?.quarters).toEqual([4])
  })
})

describe('okr completeness', () => {
  it('marks thin when <2 KR', () => {
    const krs = parseKeyResults('[{"kr":"Only one","progress":0.5}]')
    expect(assessCompleteness({ hasObjective: true, krs, updatedAt: new Date().toISOString() }).status).toBe(
      'thin',
    )
  })

  it('marks done at >=80%', () => {
    const krs = parseKeyResults(
      '[{"kr":"A","progress":0.9},{"kr":"B","progress":0.85}]',
    )
    expect(
      assessCompleteness({
        hasObjective: true,
        krs,
        updatedAt: new Date().toISOString(),
      }).status,
    ).toBe('done')
  })
})
