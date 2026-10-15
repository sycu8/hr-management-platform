import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type DeptRow = { department: string; count: number }

const dashboard = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

dashboard.use('*', requireAuth)

dashboard.get('/summary', requireModule('dash', 1), async (c) => {
  const user = c.get('user')
  const org = user.organizationId

  const active = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM employees
     WHERE organization_id = ? AND status = 'active'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const left = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM employees
     WHERE organization_id = ? AND status = 'left'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const pendingLeave = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM leave_requests
     WHERE organization_id = ? AND status = 'pending'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const pendingTrips = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM trips
     WHERE organization_id = ? AND status IN ('pm','ph','st')`,
  )
    .bind(org)
    .first<{ n: number }>()

  const { results: byDept } = await c.env.DB.prepare(
    `SELECT department, COUNT(*) AS count
     FROM employees
     WHERE organization_id = ? AND status = 'active'
     GROUP BY department
     ORDER BY count DESC, department`,
  )
    .bind(org)
    .all<DeptRow>()

  const activeCount = Number(active?.n ?? 0)
  const leftCount = Number(left?.n ?? 0)
  const totalEver = activeCount + leftCount
  const turnover =
    totalEver > 0 ? Math.round((leftCount / totalEver) * 1000) / 10 : 0

  return json(c, {
    activeEmployees: activeCount,
    leftEmployees: leftCount,
    turnover12mPct: turnover,
    presenceToday: null,
    openTasks: Number(pendingLeave?.n ?? 0) + Number(pendingTrips?.n ?? 0),
    byDepartment: (byDept ?? []).map((r) => ({
      department: r.department,
      count: Number(r.count),
    })),
  })
})

export default dashboard
