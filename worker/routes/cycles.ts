import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import {
  cycleStatusLabel,
  deriveFinalScore,
  isCycleStatus,
  progressPct,
  type CycleStatus,
} from '../lib/cycles.ts'
import { badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import {
  isElevated,
  resolveEmployeeScope,
  scopeAllowsEmployee,
  scopeSqlClause,
} from '../lib/scope.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type CycleRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  created_at: string
}

type RatingRow = {
  id: string | null
  employee_id: string
  employee_code: string
  employee_name: string
  department: string | null
  title: string | null
  self_score: number | null
  manager_score: number | null
  final_score: number | null
}

const cycles = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

cycles.use('*', requireAuth)

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const createSchema = z.object({
  name: z.string().min(1).max(200),
  start_date: dateSchema,
  end_date: dateSchema,
})

const upsertSchema = z.object({
  employee_id: z.string().min(1),
  self_score: z.number().min(0).max(5).nullable().optional(),
  manager_score: z.number().min(0).max(5).nullable().optional(),
  final_score: z.number().min(0).max(5).nullable().optional(),
})

async function audit(
  env: Env,
  user: AuthUser,
  action: string,
  entityId: string,
  detail: string,
) {
  await writeAuditEvent(env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action,
    entityType: 'review_cycle',
    entityId,
    detail,
  })
}

async function loadCycle(
  env: Env,
  orgId: string,
  id: string,
): Promise<CycleRow | null> {
  return env.DB.prepare(
    `SELECT id, name, start_date, end_date, status, created_at
     FROM review_cycles
     WHERE organization_id = ? AND id = ?
     LIMIT 1`,
  )
    .bind(orgId, id)
    .first<CycleRow>()
}

async function cycleCounts(
  env: Env,
  orgId: string,
  cycleId: string,
): Promise<{ completed_count: number; total_count: number }> {
  const row = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total_count,
       SUM(CASE WHEN final_score IS NOT NULL THEN 1 ELSE 0 END) AS completed_count
     FROM ratings
     WHERE organization_id = ? AND cycle_id = ?`,
  )
    .bind(orgId, cycleId)
    .first<{ total_count: number; completed_count: number | null }>()

  return {
    total_count: Number(row?.total_count ?? 0),
    completed_count: Number(row?.completed_count ?? 0),
  }
}

function enrichCycle(
  row: CycleRow,
  counts: { completed_count: number; total_count: number },
) {
  const status = isCycleStatus(row.status)
    ? row.status
    : (row.status as CycleStatus)
  const completed = counts.completed_count
  const total = counts.total_count
  return {
    id: row.id,
    name: row.name,
    start_date: row.start_date,
    end_date: row.end_date,
    status,
    status_label: cycleStatusLabel(row.status),
    completed_count: completed,
    total_count: total,
    progress_pct: progressPct(completed, total),
    created_at: row.created_at,
  }
}

async function canEditManagerScores(
  env: Env,
  user: AuthUser,
  employeeId: string,
): Promise<boolean> {
  if (isElevated(user)) return true
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

cycles.get('/', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.start_date, c.end_date, c.status, c.created_at,
            COALESCE(COUNT(r.id), 0) AS total_count,
            COALESCE(SUM(CASE WHEN r.final_score IS NOT NULL THEN 1 ELSE 0 END), 0)
              AS completed_count
     FROM review_cycles c
     LEFT JOIN ratings r
       ON r.cycle_id = c.id AND r.organization_id = c.organization_id
     WHERE c.organization_id = ?
     GROUP BY c.id
     ORDER BY c.start_date DESC`,
  )
    .bind(user.organizationId)
    .all<CycleRow & { total_count: number; completed_count: number }>()

  const items = (results ?? []).map((row) =>
    enrichCycle(row, {
      completed_count: Number(row.completed_count ?? 0),
      total_count: Number(row.total_count ?? 0),
    }),
  )
  return json(c, { items })
})

cycles.post('/', requireModule('perf', 2), async (c) => {
  const user = c.get('user')
  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Dữ liệu chu kỳ không hợp lệ')
  }

  if (body.end_date < body.start_date) {
    return badRequest(c, 'Ngày kết thúc phải ≥ ngày bắt đầu')
  }

  const id = newId()
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    `INSERT INTO review_cycles (
       id, organization_id, name, start_date, end_date, status, created_at
     ) VALUES (?, ?, ?, ?, ?, 'planned', ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.name.trim(),
      body.start_date,
      body.end_date,
      now,
    )
    .run()

  await audit(c.env, user, 'cycle.create', id, body.name.trim())

  const row = await loadCycle(c.env, user.organizationId, id)
  if (!row) return notFound(c, 'Cycle not found after create')
  return json(
    c,
    { cycle: enrichCycle(row, { completed_count: 0, total_count: 0 }) },
    201,
  )
})

cycles.post('/:id/open', requireModule('perf', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const row = await loadCycle(c.env, user.organizationId, id)
  if (!row) return notFound(c, 'Không tìm thấy chu kỳ')
  if (row.status !== 'planned') {
    return badRequest(c, 'Chỉ mở được chu kỳ ở trạng thái Sắp mở')
  }

  await c.env.DB.prepare(
    `UPDATE review_cycles SET status = 'open'
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, user.organizationId)
    .run()

  const { results: employees } = await c.env.DB.prepare(
    `SELECT id FROM employees
     WHERE organization_id = ? AND status = 'active'`,
  )
    .bind(user.organizationId)
    .all<{ id: string }>()

  if (employees && employees.length > 0) {
    const stmts = employees.map((emp) =>
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO ratings (
           id, organization_id, cycle_id, employee_id,
           self_score, manager_score, final_score
         ) VALUES (?, ?, ?, ?, NULL, NULL, NULL)`,
      ).bind(newId(), user.organizationId, id, emp.id),
    )
    await c.env.DB.batch(stmts)
  }

  await audit(c.env, user, 'cycle.open', id, row.name)

  const updated = await loadCycle(c.env, user.organizationId, id)
  if (!updated) return notFound(c, 'Cycle not found')
  const counts = await cycleCounts(c.env, user.organizationId, id)
  return json(c, { cycle: enrichCycle(updated, counts) })
})

cycles.post('/:id/close', requireModule('perf', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const row = await loadCycle(c.env, user.organizationId, id)
  if (!row) return notFound(c, 'Không tìm thấy chu kỳ')
  if (row.status !== 'open') {
    return badRequest(c, 'Chỉ đóng được chu kỳ đang mở')
  }

  await c.env.DB.prepare(
    `UPDATE review_cycles SET status = 'closed'
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, user.organizationId)
    .run()

  await audit(c.env, user, 'cycle.close', id, row.name)

  const updated = await loadCycle(c.env, user.organizationId, id)
  if (!updated) return notFound(c, 'Cycle not found')
  const counts = await cycleCounts(c.env, user.organizationId, id)
  return json(c, { cycle: enrichCycle(updated, counts) })
})

cycles.get('/:id/ratings', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const cycle = await loadCycle(c.env, user.organizationId, id)
  if (!cycle) return notFound(c, 'Không tìm thấy chu kỳ')

  if (cycle.status === 'planned') {
    return json(c, {
      cycle: enrichCycle(cycle, { completed_count: 0, total_count: 0 }),
      items: [] as RatingRow[],
    })
  }

  const scope = await resolveEmployeeScope(c.env.DB, user)
  const scEmp = scopeSqlClause(scope, 'e.id')
  const scRating = scopeSqlClause(scope, 'r.employee_id')
  if (scEmp.empty || scRating.empty) {
    const counts = await cycleCounts(c.env, user.organizationId, id)
    return json(c, { cycle: enrichCycle(cycle, counts), items: [] })
  }

  // Open: all in-scope active employees. Closed: only existing rating rows.
  const { results } =
    cycle.status === 'open'
      ? await c.env.DB.prepare(
          `SELECT r.id AS id, e.id AS employee_id, e.code AS employee_code,
                  e.full_name AS employee_name, e.department, e.title,
                  r.self_score, r.manager_score, r.final_score
           FROM employees e
           LEFT JOIN ratings r
             ON r.employee_id = e.id
            AND r.cycle_id = ?
            AND r.organization_id = ?
           WHERE e.organization_id = ?
             AND (e.status = 'active' OR r.id IS NOT NULL)
             ${scEmp.sql}
           ORDER BY e.code`,
        )
          .bind(id, user.organizationId, user.organizationId, ...scEmp.binds)
          .all<RatingRow>()
      : await c.env.DB.prepare(
          `SELECT r.id AS id, e.id AS employee_id, e.code AS employee_code,
                  e.full_name AS employee_name, e.department, e.title,
                  r.self_score, r.manager_score, r.final_score
           FROM ratings r
           JOIN employees e ON e.id = r.employee_id
           WHERE r.organization_id = ?
             AND r.cycle_id = ?
             ${scRating.sql}
           ORDER BY e.code`,
        )
          .bind(user.organizationId, id, ...scRating.binds)
          .all<RatingRow>()

  const counts = await cycleCounts(c.env, user.organizationId, id)
  return json(c, {
    cycle: enrichCycle(cycle, counts),
    items: (results ?? []).map((r) => ({
      ...r,
      self_score: r.self_score == null ? null : Number(r.self_score),
      manager_score: r.manager_score == null ? null : Number(r.manager_score),
      final_score: r.final_score == null ? null : Number(r.final_score),
    })),
  })
})

cycles.put('/:id/ratings', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const cycle = await loadCycle(c.env, user.organizationId, id)
  if (!cycle) return notFound(c, 'Không tìm thấy chu kỳ')
  if (cycle.status !== 'open') {
    return badRequest(c, 'Chỉ nhập điểm khi chu kỳ đang mở')
  }

  let body: z.infer<typeof upsertSchema>
  try {
    body = upsertSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Điểm không hợp lệ (0–5)')
  }

  const scope = await resolveEmployeeScope(c.env.DB, user)
  if (!scopeAllowsEmployee(scope, body.employee_id)) {
    return forbidden(c, 'Không có quyền đánh giá nhân viên này')
  }

  const emp = await c.env.DB.prepare(
    `SELECT id, manager_id FROM employees
     WHERE organization_id = ? AND id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, body.employee_id)
    .first<{ id: string; manager_id: string | null }>()
  if (!emp) return notFound(c, 'Không tìm thấy nhân viên')

  const isSelf = !!user.employeeId && user.employeeId === body.employee_id
  const canMgr = await canEditManagerScores(c.env, user, body.employee_id)
  const elevated = isElevated(user)

  if (!elevated && !isSelf && !canMgr) {
    return forbidden(c, 'Không có quyền cập nhật điểm')
  }

  if (!elevated) {
    if (body.self_score !== undefined && !isSelf) {
      return forbidden(c, 'Chỉ nhân viên được nhập điểm tự đánh giá')
    }
    if (
      (body.manager_score !== undefined || body.final_score !== undefined) &&
      !canMgr
    ) {
      return forbidden(c, 'Chỉ quản lý / HR được nhập điểm quản lý')
    }
  }

  const existing = await c.env.DB.prepare(
    `SELECT id, self_score, manager_score, final_score FROM ratings
     WHERE organization_id = ? AND cycle_id = ? AND employee_id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, id, body.employee_id)
    .first<{
      id: string
      self_score: number | null
      manager_score: number | null
      final_score: number | null
    }>()

  const nextSelf =
    body.self_score !== undefined
      ? body.self_score
      : (existing?.self_score ?? null)
  const nextMgr =
    body.manager_score !== undefined
      ? body.manager_score
      : (existing?.manager_score ?? null)
  const nextFinal = deriveFinalScore(
    nextSelf,
    nextMgr,
    body.final_score !== undefined
      ? body.final_score
      : (existing?.final_score ?? null),
  )

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE ratings
       SET self_score = ?, manager_score = ?, final_score = ?
       WHERE id = ? AND organization_id = ?`,
    )
      .bind(nextSelf, nextMgr, nextFinal, existing.id, user.organizationId)
      .run()

    await audit(
      c.env,
      user,
      'rating.upsert',
      existing.id,
      `cycle=${id}; employee=${body.employee_id}`,
    )

    return json(c, {
      rating: {
        id: existing.id,
        employee_id: body.employee_id,
        self_score: nextSelf,
        manager_score: nextMgr,
        final_score: nextFinal,
      },
    })
  }

  const ratingId = newId()
  await c.env.DB.prepare(
    `INSERT INTO ratings (
       id, organization_id, cycle_id, employee_id,
       self_score, manager_score, final_score
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      ratingId,
      user.organizationId,
      id,
      body.employee_id,
      nextSelf,
      nextMgr,
      nextFinal,
    )
    .run()

  await audit(
    c.env,
    user,
    'rating.upsert',
    ratingId,
    `cycle=${id}; employee=${body.employee_id}`,
  )

  return json(
    c,
    {
      rating: {
        id: ratingId,
        employee_id: body.employee_id,
        self_score: nextSelf,
        manager_score: nextMgr,
        final_score: nextFinal,
      },
    },
    201,
  )
})

export default cycles
