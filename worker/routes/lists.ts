import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const lists = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

lists.use('*', requireAuth)

lists.get('/jobs', requireModule('rec', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, department, headcount, status, posted_on, deadline, location, salary_display
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
    `SELECT c.id, c.full_name, c.source, c.stage, c.score, c.email, c.phone, c.interview_at,
            j.title AS job_title
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
  const { results } = await c.env.DB.prepare(
    `SELECT id, full_name, role_title, department, start_date, tasks_json
     FROM onboarding_plans
     WHERE organization_id = ?
     ORDER BY start_date`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/leave-requests', requireModule('leave', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.working_days, l.status, l.reason,
            e.full_name AS employee_name, e.code AS employee_code
     FROM leave_requests l
     JOIN employees e ON e.id = l.employee_id
     WHERE l.organization_id = ?
     ORDER BY l.start_date DESC
     LIMIT 200`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/attendance', requireModule('leave', 1), async (c) => {
  const user = c.get('user')
  const month = c.req.query('month') // YYYY-MM optional
  const prefix = month && /^\d{4}-\d{2}$/.test(month) ? month : '2026-09'
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.work_date, a.punch_in, a.punch_out, a.source,
            e.full_name AS employee_name, e.code AS employee_code
     FROM attendance_punches a
     JOIN employees e ON e.id = a.employee_id
     WHERE a.organization_id = ? AND a.work_date LIKE ?
     ORDER BY a.work_date DESC, e.code
     LIMIT 300`,
  )
    .bind(user.organizationId, `${prefix}%`)
    .all()
  return json(c, { items: results ?? [], month: prefix })
})

lists.get('/policies', requireModule('pol', 1), async (c) => {
  const user = c.get('user')
  const category = c.req.query('category')
  const { results } = await c.env.DB.prepare(
    category
      ? `SELECT id, category, code, title, version, effective_from, summary
         FROM policy_documents
         WHERE organization_id = ? AND category = ?
         ORDER BY code`
      : `SELECT id, category, code, title, version, effective_from, summary
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
    `SELECT id, title, course_type, hours, mandatory, skill, provider
     FROM courses
     WHERE organization_id = ?
     ORDER BY title`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/certificates', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.issuer, c.issued_on, c.expires_on,
            e.full_name AS employee_name
     FROM certificates c
     JOIN employees e ON e.id = c.employee_id
     WHERE c.organization_id = ?
     ORDER BY c.expires_on`,
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

lists.get('/earnings', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.year_month, a.kind, a.title, a.amount, a.taxable, a.note,
            e.full_name AS employee_name, e.code AS employee_code
     FROM earnings a
     LEFT JOIN employees e ON e.id = a.employee_id
     WHERE a.organization_id = ?
     ORDER BY a.year_month DESC, a.title
     LIMIT 200`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/documents', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.type_name, d.file_name, d.issued_on, d.expires_on,
            e.full_name AS employee_name, e.code AS employee_code
     FROM documents d
     JOIN employees e ON e.id = d.employee_id
     WHERE d.organization_id = ?
     ORDER BY d.expires_on IS NULL, d.expires_on
     LIMIT 200`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/employment-events', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT ev.id, ev.event_date, ev.event_type, ev.detail,
            e.full_name AS employee_name, e.code AS employee_code
     FROM employment_events ev
     JOIN employees e ON e.id = ev.employee_id
     WHERE ev.organization_id = ?
     ORDER BY ev.event_date DESC
     LIMIT 200`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/job-profiles', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, code, full_name, department, title, contract_type,
            contract_start, contract_end, joined_on, status, manager_id, level
     FROM employees
     WHERE organization_id = ? AND status = 'active'
     ORDER BY contract_end IS NULL, contract_end, code`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/leave-quotas', requireModule('leave', 1), async (c) => {
  const user = c.get('user')
  const year = Number(c.req.query('year') ?? 2026) || 2026
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.year, a.days, a.reason,
            e.full_name AS employee_name, e.code AS employee_code
     FROM leave_adjustments a
     JOIN employees e ON e.id = a.employee_id
     WHERE a.organization_id = ? AND a.year = ?
     ORDER BY e.code`,
  )
    .bind(user.organizationId, year)
    .all()
  return json(c, { items: results ?? [], year })
})

lists.get('/objectives', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT o.id, o.period, o.objective, o.key_results_json,
            e.full_name AS employee_name, e.code AS employee_code
     FROM objectives o
     JOIN employees e ON e.id = o.employee_id
     WHERE o.organization_id = ?
     ORDER BY o.period DESC, e.code`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/ratings', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.self_score, r.manager_score, r.final_score,
            c.name AS cycle_name,
            e.full_name AS employee_name, e.code AS employee_code
     FROM ratings r
     JOIN employees e ON e.id = r.employee_id
     LEFT JOIN review_cycles c ON c.id = r.cycle_id
     WHERE r.organization_id = ?
     ORDER BY c.start_date DESC, e.code`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/feedback-360', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT f.id, f.period, f.competencies_json, f.scores_json,
            e.full_name AS employee_name, e.code AS employee_code
     FROM feedback_360 f
     JOIN employees e ON e.id = f.employee_id
     WHERE f.organization_id = ?
     ORDER BY f.period DESC, e.code`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
})

lists.get('/enrollments', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT en.id, en.progress, en.due_on,
            c.title AS course_title,
            e.full_name AS employee_name, e.code AS employee_code
     FROM enrollments en
     JOIN courses c ON c.id = en.course_id
     JOIN employees e ON e.id = en.employee_id
     WHERE en.organization_id = ?
     ORDER BY en.due_on IS NULL, en.due_on, e.code`,
  )
    .bind(user.organizationId)
    .all()
  return json(c, { items: results ?? [] })
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
