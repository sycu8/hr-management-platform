import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { badRequest, json, notFound } from '../lib/http.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule, requireSelfOrElevated } from '../middleware/rbac.ts'

const patchEmployeeSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  department: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(120).optional(),
  address: z.string().max(500).nullable().optional(),
  contract_type: z.string().max(120).optional(),
  contract_start: z.string().nullable().optional(),
  contract_end: z.string().nullable().optional(),
  dependents: z.number().int().min(0).max(20).optional(),
  status: z.enum(['active', 'left']).optional(),
})

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

/** Admin / elevated HR edit — require emp write (level 2). */
employees.patch('/:id', requireModule('emp', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  let body: z.infer<typeof patchEmployeeSchema>
  try {
    body = patchEmployeeSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid employee update')
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM employees WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string }>()
  if (!existing) return notFound(c, 'Employee not found')

  const fields: string[] = []
  const values: unknown[] = []
  const map: Array<[keyof z.infer<typeof patchEmployeeSchema>, string]> = [
    ['full_name', 'full_name'],
    ['email', 'email'],
    ['phone', 'phone'],
    ['department', 'department'],
    ['title', 'title'],
    ['address', 'address'],
    ['contract_type', 'contract_type'],
    ['contract_start', 'contract_start'],
    ['contract_end', 'contract_end'],
    ['dependents', 'dependents'],
    ['status', 'status'],
  ]
  for (const [key, col] of map) {
    if (body[key] !== undefined) {
      fields.push(`${col} = ?`)
      values.push(body[key])
    }
  }
  if (fields.length === 0) return badRequest(c, 'No fields to update')

  fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
  values.push(id, user.organizationId)

  await c.env.DB.prepare(
    `UPDATE employees SET ${fields.join(', ')}
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'employee.update',
    entityType: 'employee',
    entityId: id,
    detail: `Cập nhật hồ sơ nhân viên ${id}: ${Object.keys(body).join(', ')}`,
  })

  return json(c, { ok: true })
})

export default employees
