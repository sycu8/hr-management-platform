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

export type ModuleLevelMap = Partial<Record<ModuleKey, PermissionLevel>>

/** One DB read of capabilities → per-module max levels (account_type=user). */
export async function loadCapabilityModuleLevels(
  db: D1Database,
  userId: string,
): Promise<ModuleLevelMap> {
  const { results } = await db
    .prepare(
      `SELECT capability, level FROM user_capabilities WHERE user_id = ?`,
    )
    .bind(userId)
    .all<{ capability: Capability; level: number }>()

  const map: ModuleLevelMap = {}
  for (const row of results ?? []) {
    const mod = CAPABILITY_TO_MODULE[row.capability]
    if (!mod) continue
    const next = row.level as PermissionLevel
    map[mod] = Math.max(map[mod] ?? 0, next) as PermissionLevel
  }
  return map
}

function levelFromAccount(
  user: AuthUser,
  moduleKey: ModuleKey,
  caps: ModuleLevelMap | null,
): PermissionLevel {
  if (user.accountType === 'super_admin') return 2

  if (user.accountType === 'admin') {
    if (moduleKey === 'sys') return 1
    return 2
  }

  // account_type=user
  if (moduleKey === 'dash') return 1
  return (caps?.[moduleKey] ?? 0) as PermissionLevel
}

export async function getPermissionLevel(
  db: D1Database,
  user: AuthUser,
  moduleKey: ModuleKey,
  caps?: ModuleLevelMap,
): Promise<PermissionLevel> {
  if (user.accountType === 'super_admin' || user.accountType === 'admin') {
    return levelFromAccount(user, moduleKey, null)
  }
  if (moduleKey === 'dash') return 1

  const map =
    caps ?? (await loadCapabilityModuleLevels(db, user.effectiveUserId))
  return levelFromAccount(user, moduleKey, map)
}

/** All module levels in one capability query (for /me and search). */
export async function getAllModuleLevels(
  db: D1Database,
  user: AuthUser,
): Promise<Record<ModuleKey, PermissionLevel>> {
  const caps =
    user.accountType === 'user'
      ? await loadCapabilityModuleLevels(db, user.effectiveUserId)
      : null

  const out = {} as Record<ModuleKey, PermissionLevel>
  for (const mod of ALL_MODULES) {
    out[mod] = levelFromAccount(user, mod, caps)
  }
  return out
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
  const levels = await getAllModuleLevels(db, user)
  return ALL_MODULES.filter((mod) => levels[mod] > 0)
}
