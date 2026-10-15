import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { badRequest, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const urlOrEmpty = z
  .union([z.string().url(), z.literal(''), z.null()])
  .optional()

const jobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(120).optional(),
  headcount: z.number().int().min(1).max(99).optional(),
  level: z.string().max(80).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  salary_display: z.string().max(120).nullable().optional(),
  status: z.enum(['draft', 'open', 'closed']).optional(),
  posted_on: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  duties: z.array(z.string()).max(40).optional(),
  requirements: z.array(z.string()).max(40).optional(),
  benefits: z.array(z.string()).max(40).optional(),
})

const candidateSchema = z.object({
  job_id: z.string().optional(),
  full_name: z.string().min(1).max(200).optional(),
  source: z.string().max(80).nullable().optional(),
  stage: z.string().min(1).max(40).optional(),
  score: z.number().min(0).max(10).nullable().optional(),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  phone: z.string().max(40).nullable().optional(),
  interview_at: z.string().nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  recruitment_note: z.string().max(8000).nullable().optional(),
  linkedin_url: urlOrEmpty,
  facebook_url: urlOrEmpty,
  cv_url: urlOrEmpty,
  cv_file_name: z.string().max(260).nullable().optional(),
})

const onboardingSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  role_title: z.string().max(120).nullable().optional(),
  department: z.string().max(120).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  probation_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z
    .enum(['in_progress', 'due_convert', 'converted', 'cancelled'])
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
  tasks: z
    .array(z.object({ t: z.string(), done: z.boolean() }))
    .max(40)
    .optional(),
  requirements: z.array(z.string()).max(40).optional(),
  employee_id: z.string().nullable().optional(),
  candidate_id: z.string().nullable().optional(),
})

const recruitment = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

recruitment.use('*', requireAuth)

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null || v === '') return null
  return v
}

/* ---------- Jobs ---------- */

recruitment.get('/jobs/:id', requireModule('rec', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT * FROM job_requisitions WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first()
  if (!row) return notFound(c, 'Job not found')
  return json(c, {
    job: {
      ...row,
      duties: parseJsonArray(row.duties_json as string),
      requirements: parseJsonArray(row.requirements_json as string),
      benefits: parseJsonArray(row.benefits_json as string),
    },
  })
})

recruitment.post('/jobs', requireModule('rec', 2), async (c) => {
  const user = c.get('user')
  let body: z.infer<typeof jobSchema>
  try {
    body = jobSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid job payload')
  }
  if (!body.title || !body.department) {
    return badRequest(c, 'title and department required')
  }
  const id = newId()
  const status = body.status ?? 'draft'
  await c.env.DB.prepare(
    `INSERT INTO job_requisitions (
       id, organization_id, title, department, headcount, level, location, salary_display,
       status, posted_on, deadline, summary, duties_json, requirements_json, benefits_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.title,
      body.department,
      body.headcount ?? 1,
      body.level ?? null,
      body.location ?? null,
      body.salary_display ?? null,
      status,
      body.posted_on ?? (status === 'open' ? new Date().toISOString().slice(0, 10) : null),
      body.deadline ?? null,
      body.summary ?? null,
      JSON.stringify(body.duties ?? []),
      JSON.stringify(body.requirements ?? []),
      JSON.stringify(body.benefits ?? []),
    )
    .run()
  await audit(c, user, 'job.create', 'job_requisition', id, `Tạo JD ${body.title}`)
  return json(c, { id }, 201)
})

recruitment.patch('/jobs/:id', requireModule('rec', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  let body: z.infer<typeof jobSchema>
  try {
    body = jobSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid job update')
  }
  const existing = await c.env.DB.prepare(
    `SELECT id FROM job_requisitions WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Job not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  if (body.title !== undefined) set('title', body.title)
  if (body.department !== undefined) set('department', body.department)
  if (body.headcount !== undefined) set('headcount', body.headcount)
  if (body.level !== undefined) set('level', body.level)
  if (body.location !== undefined) set('location', body.location)
  if (body.salary_display !== undefined) set('salary_display', body.salary_display)
  if (body.status !== undefined) set('status', body.status)
  if (body.posted_on !== undefined) set('posted_on', body.posted_on)
  if (body.deadline !== undefined) set('deadline', body.deadline)
  if (body.summary !== undefined) set('summary', body.summary)
  if (body.duties !== undefined) set('duties_json', JSON.stringify(body.duties))
  if (body.requirements !== undefined) {
    set('requirements_json', JSON.stringify(body.requirements))
  }
  if (body.benefits !== undefined) {
    set('benefits_json', JSON.stringify(body.benefits))
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  values.push(id, user.organizationId)
  await c.env.DB.prepare(
    `UPDATE job_requisitions SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()
  await audit(c, user, 'job.update', 'job_requisition', id, `Cập nhật JD`)
  return json(c, { ok: true })
})

/* ---------- Candidates ---------- */

recruitment.get('/candidates/:id', requireModule('rec', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT c.*, j.title AS job_title
     FROM candidates c
     LEFT JOIN job_requisitions j ON j.id = c.job_id
     WHERE c.organization_id = ? AND c.id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first()
  if (!row) return notFound(c, 'Candidate not found')
  return json(c, { candidate: row })
})

recruitment.post('/candidates', requireModule('rec', 2), async (c) => {
  const user = c.get('user')
  let body: z.infer<typeof candidateSchema>
  try {
    body = candidateSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid candidate payload')
  }
  if (!body.job_id || !body.full_name) {
    return badRequest(c, 'job_id and full_name required')
  }
  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO candidates (
       id, organization_id, job_id, full_name, source, stage, score, email, phone,
       interview_at, note, linkedin_url, facebook_url, cv_url, cv_file_name, recruitment_note
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.job_id,
      body.full_name,
      body.source ?? null,
      body.stage ?? 'new',
      body.score ?? 0,
      emptyToNull(body.email as string | null | undefined),
      body.phone ?? null,
      body.interview_at ?? null,
      body.note ?? null,
      emptyToNull(body.linkedin_url as string | null | undefined),
      emptyToNull(body.facebook_url as string | null | undefined),
      emptyToNull(body.cv_url as string | null | undefined),
      body.cv_file_name ?? null,
      body.recruitment_note ?? null,
    )
    .run()
  await audit(c, user, 'candidate.create', 'candidate', id, `Thêm UV ${body.full_name}`)
  return json(c, { id }, 201)
})

recruitment.patch('/candidates/:id', requireModule('rec', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  let body: z.infer<typeof candidateSchema>
  try {
    body = candidateSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid candidate update')
  }
  const existing = await c.env.DB.prepare(
    `SELECT id FROM candidates WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Candidate not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  if (body.job_id !== undefined) set('job_id', body.job_id)
  if (body.full_name !== undefined) set('full_name', body.full_name)
  if (body.source !== undefined) set('source', body.source)
  if (body.stage !== undefined) set('stage', body.stage)
  if (body.score !== undefined) set('score', body.score)
  if (body.email !== undefined) set('email', emptyToNull(body.email as string | null))
  if (body.phone !== undefined) set('phone', body.phone)
  if (body.interview_at !== undefined) set('interview_at', body.interview_at)
  if (body.note !== undefined) set('note', body.note)
  if (body.recruitment_note !== undefined) set('recruitment_note', body.recruitment_note)
  if (body.linkedin_url !== undefined) {
    set('linkedin_url', emptyToNull(body.linkedin_url as string | null))
  }
  if (body.facebook_url !== undefined) {
    set('facebook_url', emptyToNull(body.facebook_url as string | null))
  }
  if (body.cv_url !== undefined) set('cv_url', emptyToNull(body.cv_url as string | null))
  if (body.cv_file_name !== undefined) set('cv_file_name', body.cv_file_name)
  fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
  if (fields.length <= 1) return badRequest(c, 'No fields')
  values.push(id, user.organizationId)
  await c.env.DB.prepare(
    `UPDATE candidates SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()
  await audit(c, user, 'candidate.update', 'candidate', id, 'Cập nhật ứng viên')
  return json(c, { ok: true })
})

/* ---------- Onboarding ---------- */

recruitment.get('/onboarding/:id', requireModule('rec', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT * FROM onboarding_plans WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first()
  if (!row) return notFound(c, 'Onboarding not found')
  return json(c, {
    plan: {
      ...row,
      tasks: parseJsonArray(row.tasks_json as string),
      requirements: parseJsonArray((row.requirements_json as string) || '[]'),
    },
  })
})

recruitment.post('/onboarding', requireModule('rec', 2), async (c) => {
  const user = c.get('user')
  let body: z.infer<typeof onboardingSchema>
  try {
    body = onboardingSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid onboarding payload')
  }
  if (!body.full_name || !body.start_date) {
    return badRequest(c, 'full_name and start_date required')
  }
  const id = newId()
  const probationEnd = body.probation_end ?? addMonths(body.start_date, 3)
  const defaultTasks = [
    { t: 'Ký hợp đồng thử việc / HĐLĐ', done: false },
    { t: 'Thu hồ sơ (CCCD, bằng cấp, sổ BHXH)', done: false },
    { t: 'Tạo email & tài khoản hệ thống', done: false },
    { t: 'Cấp thiết bị làm việc', done: false },
    { t: 'Orientation nội quy & văn hóa', done: false },
    { t: 'Gặp QL trực tiếp — mục tiêu 30/60/90 ngày', done: false },
    { t: 'Đăng ký BHXH / BHYT', done: false },
    { t: 'Hoàn thành khóa đào tạo bắt buộc', done: false },
  ]
  await c.env.DB.prepare(
    `INSERT INTO onboarding_plans (
       id, organization_id, candidate_id, employee_id, full_name, role_title, department,
       start_date, tasks_json, probation_end, status, notes, requirements_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.candidate_id ?? null,
      body.employee_id ?? null,
      body.full_name,
      body.role_title ?? null,
      body.department ?? null,
      body.start_date,
      JSON.stringify(body.tasks ?? defaultTasks),
      probationEnd,
      body.status ?? 'in_progress',
      body.notes ?? null,
      JSON.stringify(
        body.requirements ?? [
          'Hoàn tất checklist onboarding',
          'Đánh giá thử việc từ QL trực tiếp',
          'Chuyển HĐ chính thức sau 3 tháng',
        ],
      ),
    )
    .run()
  await audit(c, user, 'onboarding.create', 'onboarding_plan', id, `Onboard ${body.full_name}`)
  return json(c, { id }, 201)
})

recruitment.patch('/onboarding/:id', requireModule('rec', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  let body: z.infer<typeof onboardingSchema>
  try {
    body = onboardingSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid onboarding update')
  }
  const existing = await c.env.DB.prepare(
    `SELECT id, start_date FROM onboarding_plans WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string; start_date: string }>()
  if (!existing) return notFound(c, 'Onboarding not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  if (body.full_name !== undefined) set('full_name', body.full_name)
  if (body.role_title !== undefined) set('role_title', body.role_title)
  if (body.department !== undefined) set('department', body.department)
  if (body.start_date !== undefined) set('start_date', body.start_date)
  if (body.probation_end !== undefined) set('probation_end', body.probation_end)
  if (body.status !== undefined) set('status', body.status)
  if (body.notes !== undefined) set('notes', body.notes)
  if (body.employee_id !== undefined) set('employee_id', body.employee_id)
  if (body.candidate_id !== undefined) set('candidate_id', body.candidate_id)
  if (body.tasks !== undefined) set('tasks_json', JSON.stringify(body.tasks))
  if (body.requirements !== undefined) {
    set('requirements_json', JSON.stringify(body.requirements))
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  values.push(id, user.organizationId)
  await c.env.DB.prepare(
    `UPDATE onboarding_plans SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()
  await audit(c, user, 'onboarding.update', 'onboarding_plan', id, 'Cập nhật onboarding')
  return json(c, { ok: true })
})

/** Mark due_convert when probation ended; optionally link employee. */
recruitment.post(
  '/onboarding/:id/mark-convert',
  requireModule('rec', 2),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const body = (await c.req.json().catch(() => ({}))) as {
      employee_id?: string
      converted?: boolean
    }
    const status = body.converted ? 'converted' : 'due_convert'
    await c.env.DB.prepare(
      `UPDATE onboarding_plans
       SET status = ?, employee_id = COALESCE(?, employee_id)
       WHERE id = ? AND organization_id = ?`,
    )
      .bind(status, body.employee_id ?? null, id, user.organizationId)
      .run()
    await audit(
      c,
      user,
      'onboarding.convert',
      'onboarding_plan',
      id,
      status === 'converted'
        ? 'Đã chuyển hồ sơ nhân viên chính thức'
        : 'Nhắc chuyển chính thức sau thử việc',
    )
    return json(c, { ok: true, status })
  },
)

function parseJsonArray(raw: string): unknown[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

async function audit(
  c: { env: Env },
  user: AuthUser,
  action: string,
  entityType: string,
  entityId: string,
  detail: string,
) {
  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action,
    entityType,
    entityId,
    detail,
  })
}

export default recruitment
