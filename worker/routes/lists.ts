import { Hono } from 'hono'
import { leaveQuota } from '../../shared/domain/leave.ts'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import {
  resolveEmployeeScope,
  type EmployeeScope,
} from '../lib/scope.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const lists = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

lists.use('*', requireAuth)

function filterByEmployeeId<T extends { employee_id?: string | null }>(
  scope: EmployeeScope,
  rows: T[],
): T[] {
  if (scope.mode === 'all') return rows
  if (scope.mode === 'none') return []
  const allowed = new Set(scope.ids)
  return rows.filter((r) => r.employee_id && allowed.has(r.employee_id))
}

lists.get('/jobs', requireModule('rec', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, department, headcount, status, posted_on, deadline, location,
            salary_display, level, summary
     FROM job_requisitions
     WHERE organization_id = ?
     ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, posted_on DESC`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/candidates', requireModule('rec', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.job_id, c.full_name, c.source, c.stage, c.score, c.email, c.phone,
            c.interview_at, c.note, c.recruitment_note, c.linkedin_url, c.facebook_url,
            c.cv_url, c.cv_file_name, j.title AS job_title
     FROM candidates c
     LEFT JOIN job_requisitions j ON j.id = c.job_id
     WHERE c.organization_id = ?
     ORDER BY c.updated_at DESC`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/onboarding', requireModule('rec', 1), async (c) => {
  const user = c.get('user')
  const today = new Date().toISOString().slice(0, 10)
  const { results } = await c.env.DB.prepare(
    `SELECT id, full_name, role_title, department, start_date, tasks_json,
            probation_end, status, notes, requirements_json, employee_id, candidate_id,
            CASE
              WHEN status = 'converted' THEN 0
              WHEN probation_end IS NOT NULL AND probation_end <= ? THEN 1
              ELSE 0
            END AS due_convert
     FROM onboarding_plans
     WHERE organization_id = ?
     ORDER BY
       CASE WHEN status = 'converted' THEN 1 WHEN status = 'cancelled' THEN 2 ELSE 0 END,
       due_convert DESC,
       start_date`,
  )
    .bind(today, user.organizationId)
    .all()

  // Soft-flag due_convert; parse checklist for card UI
  const items = (results ?? []).map((r) => {
    const due = (r.due_convert as number) === 1 && r.status !== 'converted'
    let tasks: unknown[] = []
    try {
      const parsed = JSON.parse((r.tasks_json as string) || '[]') as unknown
      tasks = Array.isArray(parsed) ? parsed : []
    } catch {
      tasks = []
    }
    return {
      ...r,
      tasks,
      remind_convert: due,
      status:
        due && r.status === 'in_progress' ? 'due_convert' : (r.status as string),
    }
  })
  return json(c, { items })
})

lists.get('/leave-requests', requireModule('leave', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.working_days, l.status, l.reason,
            l.reject_note, l.employee_id,
            e.full_name AS employee_name, e.code AS employee_code
     FROM leave_requests l
     JOIN employees e ON e.id = l.employee_id
     WHERE l.organization_id = ?
     ORDER BY CASE l.status WHEN 'pending' THEN 0 ELSE 1 END, l.start_date DESC
     LIMIT 200`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

lists.get('/attendance', requireModule('leave', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const month = c.req.query('month') // YYYY-MM optional
  const now = new Date()
  const currentYm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const prefix = month && /^\d{4}-\d{2}$/.test(month) ? month : currentYm
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.work_date, a.punch_in, a.punch_out, a.source, a.employee_id,
            e.full_name AS employee_name, e.code AS employee_code
     FROM attendance_punches a
     JOIN employees e ON e.id = a.employee_id
     WHERE a.organization_id = ? AND a.work_date LIKE ?
     ORDER BY a.work_date DESC, e.code
     LIMIT 300`,
  )
    .bind(user.organizationId, `${prefix}%`)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
    month: prefix,
  })
})

lists.get('/policies', requireModule('pol', 1), async (c) => {
  const user = c.get('user')
  const category = c.req.query('category')
  const { results } = await c.env.DB.prepare(
    category
      ? `SELECT id, category, code, title, policy_type, version,
                effective_from, effective_to, status, applicable_departments,
                summary, content_text, file_name, r2_key, owner_name,
                last_reviewed_at, updated_at
         FROM policy_documents
         WHERE organization_id = ? AND category = ?
         ORDER BY code`
      : `SELECT id, category, code, title, policy_type, version,
                effective_from, effective_to, status, applicable_departments,
                summary, content_text, file_name, r2_key, owner_name,
                last_reviewed_at, updated_at
         FROM policy_documents
         WHERE organization_id = ?
         ORDER BY category, code`,
  )
    .bind(...(category ? [user.organizationId, category] : [user.organizationId]))
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/courses', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, code, title, course_type, level, hours, delivery_mode, audience,
            mandatory, skill, provider, status, start_date, end_date, description
     FROM courses
     WHERE organization_id = ?
     ORDER BY COALESCE(code, title)`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/certificates', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.cert_number, c.issuer, c.issued_on, c.expires_on,
            c.course_id, c.file_name, c.file_url,
            e.full_name AS employee_name, e.code AS employee_code,
            co.title AS course_title
     FROM certificates c
     JOIN employees e ON e.id = c.employee_id
     LEFT JOIN courses co ON co.id = c.course_id
     WHERE c.organization_id = ?
     ORDER BY c.expires_on IS NULL, c.expires_on, e.code`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/cycles', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, start_date, end_date, status
     FROM review_cycles
     WHERE organization_id = ?
     ORDER BY start_date DESC`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/security', requireModule('sys', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT organization_id, mask_salary, require_2fa, session_minutes, log_exports
     FROM security_settings
     WHERE organization_id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId)
    .first<{
      organization_id: string
      mask_salary: number
      require_2fa: number
      session_minutes: number
      log_exports: number
    }>()

  return json(c, {
    settings: row
      ? {
          maskSalary: !!row.mask_salary,
          require2fa: !!row.require_2fa,
          sessionMinutes: Number(row.session_minutes),
          logExports: !!row.log_exports,
        }
      : null,
  })
})

lists.get('/exports', requireModule('sys', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, kind, status, r2_key, requested_by, created_at, completed_at
     FROM export_jobs
     WHERE organization_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/earnings', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.year_month, a.kind, a.title, a.amount, a.taxable, a.note,
            a.employee_id,
            e.full_name AS employee_name, e.code AS employee_code
     FROM earnings a
     LEFT JOIN employees e ON e.id = a.employee_id
     WHERE a.organization_id = ?
     ORDER BY a.year_month DESC, a.title
     LIMIT 200`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string | null }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

lists.get('/documents', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const type = c.req.query('type')
  const { results } = await c.env.DB.prepare(
    type
      ? `SELECT d.id, d.type_name, d.file_name, d.issued_on, d.expires_on,
            d.employee_id, d.r2_key,
            e.full_name AS employee_name, e.code AS employee_code
         FROM documents d
         JOIN employees e ON e.id = d.employee_id
         WHERE d.organization_id = ? AND d.type_name = ?
         ORDER BY d.expires_on IS NULL, d.expires_on
         LIMIT 200`
      : `SELECT d.id, d.type_name, d.file_name, d.issued_on, d.expires_on,
            d.employee_id, d.r2_key,
            e.full_name AS employee_name, e.code AS employee_code
         FROM documents d
         JOIN employees e ON e.id = d.employee_id
         WHERE d.organization_id = ?
         ORDER BY d.expires_on IS NULL, d.expires_on
         LIMIT 200`,
  )
    .bind(...(type ? [user.organizationId, type] : [user.organizationId]))
    .all<{ employee_id: string; r2_key: string | null }>()
  const items = filterByEmployeeId(scope, results ?? []).map((d) => ({
    ...d,
    has_file: !!d.r2_key,
    r2_key: undefined,
  }))
  return json(c, { items })
})

lists.get('/employment-events', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT ev.id, ev.event_date, ev.event_type, ev.detail, ev.employee_id,
            e.full_name AS employee_name, e.code AS employee_code
     FROM employment_events ev
     JOIN employees e ON e.id = ev.employee_id
     WHERE ev.organization_id = ?
     ORDER BY ev.event_date DESC
     LIMIT 200`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

lists.get('/job-profiles', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT id, code, full_name, department, title, contract_type,
            contract_start, contract_end, joined_on, status, manager_id, level
     FROM employees
     WHERE organization_id = ? AND status = 'active'
     ORDER BY contract_end IS NULL, contract_end, code`,
  )
    .bind(user.organizationId)
    .all<{ id: string }>()
  const items = (results ?? []).filter((r) => {
    if (scope.mode === 'all') return true
    if (scope.mode === 'none') return false
    return scope.ids.includes(r.id)
  })
  return json(c, { items })
})

lists.get('/leave-quotas', requireModule('leave', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const year = Number(c.req.query('year') ?? new Date().getFullYear()) || 2026
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.year, a.days, a.reason, a.employee_id,
            e.full_name AS employee_name, e.code AS employee_code
     FROM leave_adjustments a
     JOIN employees e ON e.id = a.employee_id
     WHERE a.organization_id = ? AND a.year = ?
     ORDER BY e.code`,
  )
    .bind(user.organizationId, year)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
    year,
  })
})

lists.get('/objectives', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.period, o.objective, o.key_results_json, o.employee_id,
            e.full_name AS employee_name, e.code AS employee_code
     FROM objectives o
     JOIN employees e ON e.id = o.employee_id
     WHERE o.organization_id = ?
     ORDER BY o.period DESC, e.code`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

lists.get('/ratings', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.self_score, r.manager_score, r.final_score, r.employee_id,
            c.name AS cycle_name,
            e.full_name AS employee_name, e.code AS employee_code
     FROM ratings r
     JOIN employees e ON e.id = r.employee_id
     LEFT JOIN review_cycles c ON c.id = r.cycle_id
     WHERE r.organization_id = ?
     ORDER BY c.start_date DESC, e.code`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

lists.get('/feedback-360', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT f.id, f.period, f.competencies_json, f.scores_json, f.employee_id,
            e.full_name AS employee_name, e.code AS employee_code
     FROM feedback_360 f
     JOIN employees e ON e.id = f.employee_id
     WHERE f.organization_id = ?
     ORDER BY f.period DESC, e.code`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

lists.get('/enrollments', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT en.id, en.employee_id, en.course_id, en.progress, en.score,
            en.due_on, en.enrolled_on, en.completed_on,
            c.title AS course_title, c.mandatory AS course_mandatory,
            e.full_name AS employee_name, e.code AS employee_code
     FROM enrollments en
     JOIN courses c ON c.id = en.course_id
     JOIN employees e ON e.id = en.employee_id
     WHERE en.organization_id = ?
     ORDER BY en.due_on IS NULL, en.due_on, e.code`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

lists.get('/careers', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, levels_json
     FROM career_paths
     WHERE organization_id = ?
     ORDER BY name`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/employee-careers', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const { results } = await c.env.DB.prepare(
    `SELECT ec.employee_id AS id, ec.employee_id, ec.path_id, ec.level_index,
            e.full_name AS employee_name, e.code AS employee_code,
            e.department, p.name AS path_name, p.levels_json
     FROM employee_careers ec
     JOIN employees e ON e.id = ec.employee_id
     JOIN career_paths p ON p.id = ec.path_id
     WHERE ec.organization_id = ?
     ORDER BY e.code`,
  )
    .bind(user.organizationId)
    .all<{ employee_id: string }>()
  return json(c, {
    items: filterByEmployeeId(scope, results ?? []),
  })
})

/** Remaining leave balances (annual / used / pending / remaining). */
lists.get('/leave-balances', requireModule('leave', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const year = Number(c.req.query('year') ?? new Date().getFullYear()) || 2026

  type Emp = {
    id: string
    code: string
    full_name: string
    joined_on: string
  }
  let employees: Emp[] = []
  if (scope.mode === 'all') {
    const { results } = await c.env.DB.prepare(
      `SELECT id, code, full_name, joined_on FROM employees
       WHERE organization_id = ? AND status = 'active' ORDER BY code`,
    )
      .bind(user.organizationId)
      .all<Emp>()
    employees = results ?? []
  } else if (scope.mode === 'ids') {
    if (scope.ids.length === 0) return json(c, { items: [], year })
    const ph = scope.ids.map(() => '?').join(',')
    const { results } = await c.env.DB.prepare(
      `SELECT id, code, full_name, joined_on FROM employees
       WHERE organization_id = ? AND id IN (${ph}) ORDER BY code`,
    )
      .bind(user.organizationId, ...scope.ids)
      .all<Emp>()
    employees = results ?? []
  }

  const { results: leaves } = await c.env.DB.prepare(
    `SELECT id, employee_id, leave_type, start_date, end_date, working_days, status
     FROM leave_requests WHERE organization_id = ?`,
  )
    .bind(user.organizationId)
    .all<{
      id: string
      employee_id: string
      leave_type: string
      start_date: string
      end_date: string
      working_days: number
      status: string
    }>()

  const { results: adjs } = await c.env.DB.prepare(
    `SELECT employee_id, days FROM leave_adjustments
     WHERE organization_id = ? AND year = ?`,
  )
    .bind(user.organizationId, year)
    .all<{ employee_id: string; days: number }>()

  const adjMap: Record<string, number> = {}
  for (const a of adjs ?? []) adjMap[a.employee_id] = a.days

  const leaveRows = (leaves ?? []).map((l) => ({
    id: l.id,
    empId: l.employee_id,
    type: l.leave_type,
    from: l.start_date,
    to: l.end_date,
    days: l.working_days,
    status: l.status,
  }))

  const asOf = new Date(`${year}-12-31T12:00:00Z`)
  const cfg = { annual: 12, sick: 30, special: 3 }
  const items = employees.map((e) => {
    const q = leaveQuota(
      { id: e.id, joined: e.joined_on },
      leaveRows,
      cfg,
      adjMap,
      asOf,
    )
    return {
      employee_id: e.id,
      employee_code: e.code,
      employee_name: e.full_name,
      year,
      annual: q.annual,
      adjustment: q.adj,
      used_annual: q.usedA,
      pending_annual: q.pendA,
      remaining_annual: q.remA,
      used_sick: q.usedS,
      used_special: q.usedP,
      used_unpaid: q.usedU,
    }
  })

  return json(c, { items, year })
})

lists.get('/travel-policy', requireModule('trip', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, version, effective_from, effective_to, approved_by, approved_at
     FROM travel_policy_versions
     WHERE organization_id = ?
     ORDER BY version DESC`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

export default lists
