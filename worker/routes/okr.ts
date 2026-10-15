import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import {
  assessCompleteness,
  avgProgress,
  COMPLETENESS_LABEL,
  parseKeyResults,
  parsePeriod,
  periodMatchesYear,
  periodTouchesQuarter,
  type Completeness,
  type KeyResult,
} from '../lib/okr.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { getPermissionLevel, requireModule } from '../middleware/rbac.ts'

type ObjRow = {
  id: string
  employee_id: string
  period: string
  objective: string
  key_results_json: string
  updated_at: string | null
  updated_by: string | null
  created_at: string
  employee_name: string
  employee_code: string
  department: string
  title: string
  manager_id: string | null
}

const krSchema = z.object({
  kr: z.string().min(1).max(300),
  progress: z.number().min(0).max(1),
  target: z.number().optional(),
  current: z.number().optional(),
  unit: z.string().max(40).optional(),
  reverse: z.boolean().optional(),
  note: z.string().max(500).optional(),
  updated_at: z.string().optional(),
})

const patchSchema = z.object({
  objective: z.string().min(1).max(500).optional(),
  key_results: z.array(krSchema).min(1).max(12).optional(),
})

const createSchema = z.object({
  employee_id: z.string().min(1).optional(),
  period: z.string().min(1).max(40),
  objective: z.string().min(1).max(500),
  key_results: z.array(krSchema).min(1).max(12),
})

const okr = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

okr.use('*', requireAuth)

function isElevated(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

async function canManageEmployee(
  env: Env,
  user: AuthUser,
  employeeId: string,
): Promise<boolean> {
  if (isElevated(user)) return true
  if (user.employeeId && user.employeeId === employeeId) return true
  if (!user.employeeId) return false
  const row = await env.DB.prepare(
    `SELECT id FROM employees
     WHERE organization_id = ? AND id = ? AND manager_id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, employeeId, user.employeeId)
    .first()
  return !!row
}

function enrich(row: ObjRow) {
  const krs = parseKeyResults(row.key_results_json)
  const completeness = assessCompleteness({
    hasObjective: true,
    krs,
    updatedAt: row.updated_at ?? row.created_at,
  })
  const parsed = parsePeriod(row.period)
  return {
    id: row.id,
    employee_id: row.employee_id,
    employee_code: row.employee_code,
    employee_name: row.employee_name,
    department: row.department,
    title: row.title,
    manager_id: row.manager_id,
    period: row.period,
    period_label: parsed?.label ?? row.period,
    year: parsed?.year ?? null,
    quarters: parsed?.quarters ?? [],
    objective: row.objective,
    key_results: krs,
    progress: completeness.avg,
    progress_pct: Math.round(completeness.avg * 100),
    completeness: completeness.status,
    completeness_label: COMPLETENESS_LABEL[completeness.status],
    kr_count: completeness.krCount,
    updated_at: row.updated_at ?? row.created_at,
    updated_by: row.updated_by,
    created_at: row.created_at,
  }
}

okr.get('/', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const year = Number(c.req.query('year') || new Date().getFullYear()) || 2026
  const quarterRaw = c.req.query('quarter')
  const quarter = quarterRaw ? Number(quarterRaw) : null
  const scope = (c.req.query('scope') || 'all') as 'mine' | 'team' | 'all'

  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.employee_id, o.period, o.objective, o.key_results_json,
            o.updated_at, o.updated_by, o.created_at,
            e.full_name AS employee_name, e.code AS employee_code,
            e.department, e.title, e.manager_id
     FROM objectives o
     JOIN employees e ON e.id = o.employee_id
     WHERE o.organization_id = ?
     ORDER BY o.period DESC, e.code`,
  )
    .bind(user.organizationId)
    .all<ObjRow>()

  let items = (results ?? []).map(enrich)

  items = items.filter((o) => {
    if (!periodMatchesYear(o.period, year)) return false
    if (quarter != null && quarter >= 1 && quarter <= 4) {
      return periodTouchesQuarter(o.period, year, quarter)
    }
    return true
  })

  if (scope === 'mine') {
    if (!user.employeeId) return json(c, { items: [], year, quarter, scope })
    items = items.filter((o) => o.employee_id === user.employeeId)
  } else if (scope === 'team') {
    if (isElevated(user)) {
      // admin sees all as "team org"
    } else if (user.employeeId) {
      items = items.filter(
        (o) =>
          o.manager_id === user.employeeId || o.employee_id === user.employeeId,
      )
    } else {
      items = []
    }
  }

  return json(c, { items, year, quarter, scope })
})

/** Year dashboard: completeness & progress by quarter for manager / HR. */
okr.get('/summary', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const year = Number(c.req.query('year') || 2026) || 2026
  const scope = (c.req.query('scope') || 'team') as 'team' | 'all'

  type EmpRow = {
    id: string
    code: string
    full_name: string
    department: string
    manager_id: string | null
  }
  let employees: EmpRow[] = []

  if (scope === 'all' || isElevated(user)) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, code, full_name, department, manager_id
       FROM employees
       WHERE organization_id = ? AND status = 'active'
       ORDER BY code`,
    )
      .bind(user.organizationId)
      .all<EmpRow>()
    employees = results ?? []
  } else if (user.employeeId) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, code, full_name, department, manager_id
       FROM employees
       WHERE organization_id = ? AND status = 'active'
         AND (manager_id = ? OR id = ?)
       ORDER BY code`,
    )
      .bind(user.organizationId, user.employeeId, user.employeeId)
      .all<EmpRow>()
    employees = results ?? []
  }

  const { results: objRows } = await c.env.DB.prepare(
    `SELECT o.id, o.employee_id, o.period, o.objective, o.key_results_json,
            o.updated_at, o.updated_by, o.created_at,
            e.full_name AS employee_name, e.code AS employee_code,
            e.department, e.title, e.manager_id
     FROM objectives o
     JOIN employees e ON e.id = o.employee_id
     WHERE o.organization_id = ?`,
  )
    .bind(user.organizationId)
    .all<ObjRow>()

  const objectives = (objRows ?? [])
    .filter((o) => periodMatchesYear(o.period, year))
    .map(enrich)

  const quarters = [1, 2, 3, 4].map((q) => {
    const empStats = employees.map((emp) => {
      const objs = objectives.filter(
        (o) =>
          o.employee_id === emp.id &&
          periodTouchesQuarter(o.period, year, q),
      )
      if (objs.length === 0) {
        return {
          employee_id: emp.id,
          employee_code: emp.code,
          employee_name: emp.full_name,
          department: emp.department,
          completeness: 'missing' as Completeness,
          completeness_label: COMPLETENESS_LABEL.missing,
          progress: 0,
          progress_pct: 0,
          objectives: [] as typeof objectives,
        }
      }
      const avg = avgProgress(
        objs.flatMap((o) => o.key_results as KeyResult[]),
      )
      // Prefer worst completeness among objectives
      const order: Completeness[] = [
        'missing',
        'thin',
        'at_risk',
        'stale',
        'on_track',
        'done',
      ]
      const worst = objs
        .map((o) => o.completeness as Completeness)
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]!
      return {
        employee_id: emp.id,
        employee_code: emp.code,
        employee_name: emp.full_name,
        department: emp.department,
        completeness: worst,
        completeness_label: COMPLETENESS_LABEL[worst],
        progress: avg,
        progress_pct: Math.round(avg * 100),
        objectives: objs,
      }
    })

    const withOkr = empStats.filter((e) => e.completeness !== 'missing')
    const enough = empStats.filter((e) =>
      ['on_track', 'done', 'at_risk', 'stale'].includes(e.completeness),
    )
    const avg =
      withOkr.length === 0
        ? 0
        : withOkr.reduce((s, e) => s + e.progress, 0) / withOkr.length

    return {
      quarter: q,
      label: `Q${q}/${year}`,
      headcount: employees.length,
      with_okr: withOkr.length,
      enough: enough.length,
      missing: empStats.filter((e) => e.completeness === 'missing').length,
      thin: empStats.filter((e) => e.completeness === 'thin').length,
      done: empStats.filter((e) => e.completeness === 'done').length,
      avg_progress: avg,
      avg_progress_pct: Math.round(avg * 100),
      coverage_pct:
        employees.length === 0
          ? 0
          : Math.round((withOkr.length / employees.length) * 100),
      enough_pct:
        employees.length === 0
          ? 0
          : Math.round((enough.length / employees.length) * 100),
      employees: empStats,
    }
  })

  const yearAvg =
    quarters.reduce((s, q) => s + q.avg_progress, 0) /
    (quarters.filter((q) => q.with_okr > 0).length || 1)

  return json(c, {
    year,
    scope,
    headcount: employees.length,
    year_avg_progress_pct: Math.round(yearAvg * 100),
    quarters,
  })
})

okr.post('/', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid OKR payload')
  }

  if (!parsePeriod(body.period)) {
    return badRequest(
      c,
      'Kỳ phải dạng 2026-Q1 … 2026-Q4, 2026-H1/H2 hoặc Quý 1/2026',
    )
  }

  const employeeId = body.employee_id ?? user.employeeId
  if (!employeeId) return badRequest(c, 'Thiếu employee_id')

  const allowed = await canManageEmployee(c.env, user, employeeId)
  const level = await getPermissionLevel(c.env.DB, user, 'perf')
  if (!allowed && level < 2) return forbidden(c, 'Không được tạo OKR này')

  const emp = await c.env.DB.prepare(
    `SELECT id FROM employees WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, employeeId)
    .first()
  if (!emp) return notFound(c, 'Employee not found')

  const now = new Date().toISOString()
  const krs = body.key_results.map((k) => ({
    ...k,
    updated_at: now,
  }))
  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO objectives (
       id, organization_id, employee_id, period, objective, key_results_json,
       updated_at, updated_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      employeeId,
      body.period,
      body.objective,
      JSON.stringify(krs),
      now,
      user.id,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'okr.create',
    entityType: 'objective',
    entityId: id,
    detail: `Created OKR ${body.period}`,
  })

  return json(c, { id }, 201)
})

okr.patch('/:id', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid OKR update')
  }

  const row = await c.env.DB.prepare(
    `SELECT id, employee_id, objective, key_results_json
     FROM objectives WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<{
      id: string
      employee_id: string
      objective: string
      key_results_json: string
    }>()
  if (!row) return notFound(c, 'OKR not found')

  const allowed = await canManageEmployee(c.env, user, row.employee_id)
  if (!allowed) return forbidden(c, 'Chỉ được cập nhật OKR của mình hoặc nhân viên trực tiếp')

  const now = new Date().toISOString()
  const objective = body.objective ?? row.objective
  let krs = parseKeyResults(row.key_results_json)
  if (body.key_results) {
    krs = body.key_results.map((k) => ({
      ...k,
      updated_at: now,
    }))
  }

  await c.env.DB.prepare(
    `UPDATE objectives
     SET objective = ?, key_results_json = ?, updated_at = ?, updated_by = ?
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(
      objective,
      JSON.stringify(krs),
      now,
      user.id,
      id,
      user.organizationId,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'okr.update',
    entityType: 'objective',
    entityId: id,
    detail: 'Updated OKR progress',
  })

  return json(c, { ok: true })
})

export default okr
