import { describe, expect, it } from 'vitest'
import { scorePageHit, suggestPages, buildPageCatalog } from './searchCatalog'

describe('searchCatalog', () => {
  it('indexes all nav pages', () => {
    const all = buildPageCatalog()
    expect(all.length).toBeGreaterThan(30)
  })

  it('suggests payroll for lương', () => {
    const hits = suggestPages('lương')
    expect(hits.some((h) => h.path.includes('/payroll'))).toBe(true)
  })

  it('suggests leave for nghỉ phép', () => {
    const hits = suggestPages('nghỉ phép')
    expect(hits.some((h) => h.path === '/leave')).toBe(true)
  })

  it('respects module allowlist', () => {
    const hits = suggestPages('lương', new Set(['dash']))
    expect(hits.every((h) => h.moduleKey === 'dash')).toBe(true)
  })

  it('scores exact title higher', () => {
    const catalog = buildPageCatalog()
    const payroll = catalog.find((h) => h.path === '/payroll')!
    expect(scorePageHit(payroll, 'bảng lương')).toBeGreaterThan(
      scorePageHit(payroll, 'xyz'),
    )
  })
})
