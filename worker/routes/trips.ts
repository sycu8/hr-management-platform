import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type TripListRow = {
  id: string
  code: string
  employee_id: string
  origin: string
  destination: string
  zone: string
  start_at: string
  end_at: string
  status: string
  purpose: string
}

const trips = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

trips.use('*', requireAuth)

trips.get('/', requireModule('trip', 1), async (c) => {
  const user = c.get('user')
  const status = c.req.query('status')
  const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200)
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)

  // Employees only see their own trips unless elevated via permission_matrix.
  // Full self-scope filtering refinement lives with domain/services later.
  const employeeFilter =
    user.role === 'employee' && user.employeeId ? user.employeeId : null

  const { results } = await c.env.DB.prepare(
    `SELECT id, code, employee_id, origin, destination, zone, start_at, end_at, status, purpose
     FROM trips
     WHERE organization_id = ?
       AND (? IS NULL OR status = ?)
       AND (? IS NULL OR employee_id = ?)
     ORDER BY start_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(
      user.organizationId,
      status ?? null,
      status ?? null,
      employeeFilter,
      employeeFilter,
      limit,
      offset,
    )
    .all<TripListRow>()

  return json(c, { items: results ?? [], limit, offset })
})

export default trips
