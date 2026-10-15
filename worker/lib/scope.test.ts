import { describe, expect, it } from 'vitest'
import type { AuthUser } from '../middleware/auth.ts'
import {
  isElevated,
  scopeAllowsEmployee,
  selfOnlyEmployeeFilter,
} from './scope.ts'

function user(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 'u1',
    organizationId: 'org',
    email: 'a@b.c',
    displayName: 'A',
    accountType: 'user',
    employeeId: 'e1',
    isActive: true,
    mustResetPassword: false,
    viewAsUserId: null,
    effectiveUserId: 'u1',
    actorUserId: 'u1',
    sessionId: 's1',
    ...partial,
  }
}

describe('scope helpers', () => {
  it('elevated users are not self-filtered', () => {
    expect(isElevated(user({ accountType: 'admin' }))).toBe(true)
    expect(selfOnlyEmployeeFilter(user({ accountType: 'admin' }))).toEqual({
      ok: true,
      filter: null,
    })
  })

  it('denies user accounts without employee link', () => {
    const r = selfOnlyEmployeeFilter(
      user({ accountType: 'user', employeeId: null }),
    )
    expect(r.ok).toBe(false)
  })

  it('filters linked users to self', () => {
    expect(selfOnlyEmployeeFilter(user({ employeeId: 'e9' }))).toEqual({
      ok: true,
      filter: 'e9',
    })
  })

  it('scopeAllowsEmployee respects modes', () => {
    expect(scopeAllowsEmployee({ mode: 'all' }, 'x')).toBe(true)
    expect(
      scopeAllowsEmployee({ mode: 'none', reason: 'x' }, 'e1'),
    ).toBe(false)
    expect(
      scopeAllowsEmployee({ mode: 'ids', ids: ['e1', 'e2'] }, 'e2'),
    ).toBe(true)
    expect(
      scopeAllowsEmployee({ mode: 'ids', ids: ['e1'] }, 'e9'),
    ).toBe(false)
  })
})
