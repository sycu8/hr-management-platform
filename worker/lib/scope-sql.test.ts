import { describe, expect, it } from 'vitest'
import { scopeSqlClause } from './scope.ts'

describe('scopeSqlClause', () => {
  it('returns empty for none', () => {
    expect(scopeSqlClause({ mode: 'none', reason: 'x' }, 'employee_id')).toEqual(
      { empty: true, sql: '', binds: [] },
    )
  })

  it('returns no clause for all', () => {
    expect(scopeSqlClause({ mode: 'all' }, 'employee_id')).toEqual({
      empty: false,
      sql: '',
      binds: [],
    })
  })

  it('builds IN clause for ids', () => {
    const sc = scopeSqlClause(
      { mode: 'ids', ids: ['e1', 'e2'] },
      'l.employee_id',
    )
    expect(sc.empty).toBe(false)
    expect(sc.sql).toBe(' AND l.employee_id IN (?, ?)')
    expect(sc.binds).toEqual(['e1', 'e2'])
  })
})
