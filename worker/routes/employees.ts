import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json, notFound } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule, requireSelfOrElevated } from '../middleware/rbac.ts'

type EmployeeListRow = {
  id: string
  code: string
  full_name: string
  email: string | null
  department: string
  title: string
  level: number
  status: string
  manager_id: string | null
}

type EmployeeDetailRow = EmployeeListRow & {
  phone: string | null
  gender: string | null
  birth_date: string | null
  address: string | null
  joined_on: string
  left_on: string | null
  contract_type: string
  contract_start: string | null
  contract_end: string | null
  dependents: number
  // base_salary intentionally omitted from list; detail gated by module level later
}

const employees = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

employees.use('*', requireAuth)

employees.get('/', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const status = c.req.query('status') ?? 'active'
  const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200)
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)
  const statusFilter = status === 'all' ? null : status

  const { results } = await c.env.DB.prepare(
    `SELECT id, code, full_name, email, department, title, level, status, manager_id
     FROM employees
     WHERE organization_id = ?
       AND (? IS NULL OR status = ?)
     ORDER BY code
     LIMIT ? OFFSET ?`,
  )
    .bind(user.organizationId, statusFilter, statusFilter, limit, offset)
    .all<EmployeeListRow>()

  return json(c, { items: results ?? [], limit, offset })
})

employees.get(
  '/:id',
  requireSelfOrElevated({
    moduleKey: 'emp',
    getEmployeeId: (ctx) => ctx.req.param('id'),
  }),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const row = await c.env.DB.prepare(
      `SELECT id, code, full_name, email, phone, gender, birth_date, address,
              department, title, level, status, manager_id, joined_on, left_on,
              contract_type, contract_start, contract_end, dependents
       FROM employees
       WHERE organization_id = ? AND id = ?
       LIMIT 1`,
    )
      .bind(user.organizationId, id)
      .first<EmployeeDetailRow>()

    if (!row) return notFound(c, 'Employee not found')
    return json(c, { employee: row })
  },
)

export default employees
