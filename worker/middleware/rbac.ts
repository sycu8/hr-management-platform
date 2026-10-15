import { createMiddleware } from 'hono/factory'
import {
  CAPABILITY_TO_MODULE,
  type AccountType,
  type Capability,
  type Env,
  type ModuleKey,
  type PermissionLevel,
} from '../env.ts'
import { forbidden } from '../lib/http.ts'
import {
  isElevated,
  resolveEmployeeScope,
  scopeAllowsEmployee,
} from '../lib/scope.ts'
import type { AuthUser } from './auth.ts'

type AppBindings = {
  Bindings: Env
  Variables: { user: AuthUser }
}

const ALL_MODULES: ModuleKey[] = [
  'dash',
  'emp',
  'rec',
  'leave',
  'trip',
  'pay',
  'perf',
  'learn',
  'pol',
  'sys',
]

export async function getPermissionLevel(
  db: D1Database,
  user: AuthUser,
  moduleKey: ModuleKey,
): Promise<PermissionLevel> {
  // Super admin always full access (even while viewing-as, SA retains elevated writes —
  // view-as is for perspective; mutations still allowed for SA).
  if (user.accountType === 'super_admin') return 2

  // When viewing-as, use target account permissions for reads/writes scope checks.
  const accountType: AccountType = user.accountType

  if (accountType === 'admin') {
    // HR Admin: full edit on business modules.
    // System nav (users / security / exports) at level 1 — data-source
    // integrations remain Super Admin only (enforced on those routes).
    if (moduleKey === 'sys') return 1
    return 2
  }

  // user: capabilities table
  if (moduleKey === 'dash') return 1

  const { results } = await db
    .prepare(
      `SELECT capability, level FROM user_capabilities WHERE user_id = ?`,
    )
    .bind(user.effectiveUserId)
    .all<{ capability: Capability; level: number }>()

  let level: PermissionLevel = 0
  for (const row of results ?? []) {
    const mod = CAPABILITY_TO_MODULE[row.capability]
    if (mod === moduleKey) {
      level = Math.max(level, row.level as PermissionLevel) as PermissionLevel
    }
  }
  return level
}

export function requireModule(moduleKey: ModuleKey, minLevel: PermissionLevel) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')
    const level = await getPermissionLevel(c.env.DB, user, moduleKey)
    if (level < minLevel) {
      return forbidden(c, `Insufficient permission for module "${moduleKey}"`)
    }
    await next()
  })
}

export function requireAccountTypes(...types: AccountType[]) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')
    // Account-management actions use the real session actor, not view-as target.
    // For create-user / reset-password we check actor via session reload in route,
    // here we use accountType on the set user — view-as switches accountType to target.
    // Routes that must ignore view-as should call requireActorAccountTypes.
    if (!types.includes(user.accountType) && user.accountType !== 'super_admin') {
      // If viewing-as, accountType is target — block admin actions during view-as unless SA.
      return forbidden(c, 'Insufficient account type')
    }
    if (user.viewAsUserId && !types.includes('super_admin')) {
      // Prefer explicit actor checks in sensitive routes.
    }
    await next()
  })
}

/** Actor (session owner) must be admin or super_admin — ignores view-as target. */
export function requireActorAdmin() {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')
    const session = await c.env.DB.prepare(
      `SELECT user_id FROM sessions WHERE id = ? LIMIT 1`,
    )
      .bind(user.sessionId)
      .first<{ user_id: string }>()

    if (!session) return forbidden(c, 'Session invalid')

    const actor = await c.env.DB.prepare(
      `SELECT account_type FROM users WHERE id = ? LIMIT 1`,
    )
      .bind(session.user_id)
      .first<{ account_type: AccountType }>()

    if (
      !actor ||
      (actor.account_type !== 'admin' && actor.account_type !== 'super_admin')
    ) {
      return forbidden(c, 'Admin only')
    }
    await next()
  })
}

export function requireActorSuperAdmin() {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')
    const session = await c.env.DB.prepare(
      `SELECT user_id FROM sessions WHERE id = ? LIMIT 1`,
    )
      .bind(user.sessionId)
      .first<{ user_id: string }>()

    if (!session) return forbidden(c, 'Session invalid')

    const actor = await c.env.DB.prepare(
      `SELECT account_type FROM users WHERE id = ? LIMIT 1`,
    )
      .bind(session.user_id)
      .first<{ account_type: AccountType }>()

    if (!actor || actor.account_type !== 'super_admin') {
      return forbidden(c, 'Super admin only')
    }
    await next()
  })
}

/**
 * Allow self, direct reports (manager), or Admin/SA.
 * Module read level alone must NEVER grant org-wide employee access.
 */
export function requireSelfOrElevated(options: {
  moduleKey: ModuleKey
  getEmployeeId: (c: {
    req: {
      param: (key: string) => string
      query: (key: string) => string | undefined
    }
  }) => string | undefined | null
  /** @deprecated Ignored — capability level is not org-wide elevation. */
  elevatedMinLevel?: PermissionLevel
}) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')
    const targetEmployeeId = options.getEmployeeId(c)

    if (isElevated(user)) {
      await next()
      return
    }

    if (
      targetEmployeeId &&
      user.employeeId &&
      targetEmployeeId === user.employeeId
    ) {
      await next()
      return
    }

    if (targetEmployeeId) {
      const scope = await resolveEmployeeScope(c.env.DB, user)
      if (scopeAllowsEmployee(scope, targetEmployeeId)) {
        // Ensure caller still has the module (read) before team access
        const level = await getPermissionLevel(
          c.env.DB,
          user,
          options.moduleKey,
        )
        if (level >= 1) {
          await next()
          return
        }
      }
    }

    return forbidden(c, 'Self or elevated access required')
  })
}

export async function listAllowedModules(
  db: D1Database,
  user: AuthUser,
): Promise<ModuleKey[]> {
  const allowed: ModuleKey[] = []
  for (const mod of ALL_MODULES) {
    const level = await getPermissionLevel(db, user, mod)
    if (level > 0) allowed.push(mod)
  }
  return allowed
}
