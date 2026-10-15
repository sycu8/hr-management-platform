import type { AuthUser } from '../middleware/auth.ts'

export function isElevated(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

/**
 * Self-only filter for payslips / insurance / docs.
 * Elevated → no SQL filter (null). Linked user → own employee id.
 * User account without employee_id must never see org-wide rows.
 */
export function selfOnlyEmployeeFilter(
  user: AuthUser,
): { ok: true; filter: string | null } | { ok: false; reason: string } {
  if (isElevated(user)) return { ok: true, filter: null }
  if (user.accountType === 'user' && !user.employeeId) {
    return { ok: false, reason: 'Tài khoản chưa liên kết nhân viên' }
  }
  if (user.accountType === 'user') {
    return { ok: true, filter: user.employeeId }
  }
  // Unknown account types: deny broad access
  return { ok: false, reason: 'Không có quyền xem dữ liệu này' }
}

export type EmployeeScope =
  | { mode: 'all' }
  | { mode: 'ids'; ids: string[] }
  | { mode: 'none'; reason: string }

/**
 * Team/self visibility: admin/SA → all; user → self + direct reports;
 * user without employee link → none.
 */
export async function resolveEmployeeScope(
  db: D1Database,
  user: AuthUser,
): Promise<EmployeeScope> {
  if (isElevated(user)) return { mode: 'all' }
  if (!user.employeeId) {
    return { mode: 'none', reason: 'Tài khoản chưa liên kết nhân viên' }
  }

  const { results } = await db
    .prepare(
      `SELECT id FROM employees
       WHERE organization_id = ? AND (id = ? OR manager_id = ?)`,
    )
    .bind(user.organizationId, user.employeeId, user.employeeId)
    .all<{ id: string }>()

  const ids = new Set<string>([user.employeeId])
  for (const row of results ?? []) ids.add(row.id)
  return { mode: 'ids', ids: [...ids] }
}

export function scopeAllowsEmployee(
  scope: EmployeeScope,
  employeeId: string,
): boolean {
  if (scope.mode === 'all') return true
  if (scope.mode === 'none') return false
  return scope.ids.includes(employeeId)
}

/** SQL helper: bind org + optional employee IN list. Empty ids → no rows. */
export function employeeIdInClause(
  column: string,
  scope: Extract<EmployeeScope, { mode: 'ids' }>,
): { sql: string; binds: string[] } {
  if (scope.ids.length === 0) {
    return { sql: ` AND 1 = 0`, binds: [] }
  }
  const placeholders = scope.ids.map(() => '?').join(', ')
  return {
    sql: ` AND ${column} IN (${placeholders})`,
    binds: scope.ids,
  }
}

/**
 * Push employee scope into SQL (avoids fetch-all-then-filter).
 * `empty: true` → caller should return [] without querying.
 */
export function scopeSqlClause(
  scope: EmployeeScope,
  column: string,
): { empty: boolean; sql: string; binds: string[] } {
  if (scope.mode === 'none') return { empty: true, sql: '', binds: [] }
  if (scope.mode === 'all') return { empty: false, sql: '', binds: [] }
  const clause = employeeIdInClause(column, scope)
  return { empty: false, sql: clause.sql, binds: clause.binds }
}
