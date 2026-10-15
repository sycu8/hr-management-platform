import { createMiddleware } from 'hono/factory'
import type { Env, ModuleKey, PermissionLevel } from '../env.ts'
import { forbidden } from '../lib/http.ts'
import type { AuthUser } from './auth.ts'

type AppBindings = {
  Bindings: Env
  Variables: { user: AuthUser }
}

const ELEVATED_ROLES = new Set(['admin', 'hr', 'manager', 'finance'])

async function permissionLevelFor(
  db: D1Database,
  user: AuthUser,
  moduleKey: ModuleKey,
): Promise<PermissionLevel> {
  // Admins are treated as full access when no matrix row exists.
  if (user.role === 'admin') {
    const row = await db
      .prepare(
        `SELECT level FROM permission_matrix
         WHERE organization_id = ? AND role = ? AND module_key = ?
         LIMIT 1`,
      )
      .bind(user.organizationId, user.role, moduleKey)
      .first<{ level: number }>()

    return (row?.level ?? 2) as PermissionLevel
  }

  const row = await db
    .prepare(
      `SELECT level FROM permission_matrix
       WHERE organization_id = ? AND role = ? AND module_key = ?
       LIMIT 1`,
    )
    .bind(user.organizationId, user.role, moduleKey)
    .first<{ level: number }>()

  return (row?.level ?? 0) as PermissionLevel
}

/**
 * Require at least `minLevel` on `module` for the authenticated user's DB role.
 * Levels: 0 = none, 1 = read, 2 = write.
 */
export function requireModule(moduleKey: ModuleKey, minLevel: PermissionLevel) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')
    const level = await permissionLevelFor(c.env.DB, user, moduleKey)
    if (level < minLevel) {
      return forbidden(c, `Insufficient permission for module "${moduleKey}"`)
    }
    await next()
  })
}

/**
 * Allow when the path/resource employeeId matches the caller's linked employee,
 * or when the caller has elevated org role / module write access.
 */
export function requireSelfOrElevated(options: {
  moduleKey: ModuleKey
  /** Resolve target employee id from the request (path/query/body). */
  getEmployeeId: (c: {
    req: { param: (key: string) => string; query: (key: string) => string | undefined }
  }) => string | undefined | null
  /** Min module level that counts as elevated (default 1). */
  elevatedMinLevel?: PermissionLevel
}) {
  const elevatedMin = options.elevatedMinLevel ?? 1

  return createMiddleware<AppBindings>(async (c, next) => {
    const user = c.get('user')
    const targetEmployeeId = options.getEmployeeId(c)

    if (
      targetEmployeeId &&
      user.employeeId &&
      targetEmployeeId === user.employeeId
    ) {
      await next()
      return
    }

    if (ELEVATED_ROLES.has(user.role)) {
      const level = await permissionLevelFor(
        c.env.DB,
        user,
        options.moduleKey,
      )
      if (level >= elevatedMin) {
        await next()
        return
      }
    }

    return forbidden(c, 'Self or elevated access required')
  })
}

export async function getPermissionLevel(
  db: D1Database,
  user: AuthUser,
  moduleKey: ModuleKey,
): Promise<PermissionLevel> {
  return permissionLevelFor(db, user, moduleKey)
}
