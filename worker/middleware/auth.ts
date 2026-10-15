import { createMiddleware } from 'hono/factory'
import type { AccountType, Env } from '../env.ts'
import { unauthorized } from '../lib/http.ts'
import {
  findSessionByToken,
  parseCookies,
  SESSION_COOKIE,
} from '../lib/session.ts'

export type AuthUser = {
  id: string
  organizationId: string
  email: string
  displayName: string
  accountType: AccountType
  employeeId: string | null
  isActive: boolean
  mustResetPassword: boolean
  /** When super_admin is viewing-as another user. */
  viewAsUserId: string | null
  /** Effective identity for authorization/scoping (view-as target or self). */
  effectiveUserId: string
  /** Real session owner — always use for audit attribution. */
  actorUserId: string
  sessionId: string
}

type UserRow = {
  id: string
  organization_id: string
  email: string
  display_name: string
  account_type: AccountType
  employee_id: string | null
  is_active: number
  must_reset_password: number
}

async function loadUser(
  db: D1Database,
  id: string,
): Promise<AuthUser | null> {
  const row = await db
    .prepare(
      `SELECT id, organization_id, email, display_name, account_type,
              employee_id, is_active, must_reset_password
       FROM users WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<UserRow>()

  if (!row) return null

  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    displayName: row.display_name,
    accountType: row.account_type,
    employeeId: row.employee_id,
    isActive: row.is_active === 1,
    mustResetPassword: row.must_reset_password === 1,
    viewAsUserId: null,
    effectiveUserId: row.id,
    actorUserId: row.id,
    sessionId: '',
  }
}

/**
 * Require a valid session cookie. Role/account type always from DB.
 */
export const requireAuth = createMiddleware<{
  Bindings: Env
  Variables: { user: AuthUser }
}>(async (c, next) => {
  const cookies = parseCookies(c.req.header('Cookie'))
  const token = cookies[SESSION_COOKIE]
  if (!token) return unauthorized(c, 'Authentication required')

  const session = await findSessionByToken(c.env, token)
  if (!session) return unauthorized(c, 'Session expired')

  const actor = await loadUser(c.env.DB, session.user_id)
  if (!actor || !actor.isActive) return unauthorized(c, 'User inactive')

  if (
    session.view_as_user_id &&
    actor.accountType === 'super_admin' &&
    session.view_as_user_id !== actor.id
  ) {
    const target = await loadUser(c.env.DB, session.view_as_user_id)
    if (target && target.isActive) {
      c.set('user', {
        ...target,
        viewAsUserId: target.id,
        effectiveUserId: target.id,
        actorUserId: actor.id,
        sessionId: session.id,
      })
      await next()
      return
    }
  }

  c.set('user', {
    ...actor,
    viewAsUserId: null,
    effectiveUserId: actor.id,
    actorUserId: actor.id,
    sessionId: session.id,
  })
  await next()
})

/** Optional auth — sets user when session present. */
export const optionalAuth = createMiddleware<{
  Bindings: Env
  Variables: { user?: AuthUser }
}>(async (c, next) => {
  const cookies = parseCookies(c.req.header('Cookie'))
  const token = cookies[SESSION_COOKIE]
  if (!token) {
    await next()
    return
  }
  const session = await findSessionByToken(c.env, token)
  if (!session) {
    await next()
    return
  }
  const actor = await loadUser(c.env.DB, session.user_id)
  if (actor?.isActive) {
    c.set('user', {
      ...actor,
      viewAsUserId: session.view_as_user_id,
      effectiveUserId: session.view_as_user_id || actor.id,
      actorUserId: actor.id,
      sessionId: session.id,
    })
  }
  await next()
})
