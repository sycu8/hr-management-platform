import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import {
  resolveEmployeeScope,
  scopeAllowsEmployee,
} from '../lib/scope.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const learning = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

learning.use('*', requireAuth)

function isHrAdmin(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

const dateOpt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

const courseSchema = z.object({
  code: z.string().max(40).nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  course_type: z.string().min(1).max(40).optional(),
  level: z.string().max(40).nullable().optional(),
  hours: z.number().min(0).max(999).optional(),
  delivery_mode: z.string().max(40).nullable().optional(),
  audience: z.string().max(200).nullable().optional(),
  skill: z.string().max(120).nullable().optional(),
  provider: z.string().max(200).nullable().optional(),
  mandatory: z.boolean().optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  start_date: dateOpt,
  end_date: dateOpt,
  description: z.string().max(4000).nullable().optional(),
})

const enrollmentSchema = z.object({
  employee_id: z.string().optional(),
  course_id: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  due_on: dateOpt,
  enrolled_on: dateOpt,
  completed_on: dateOpt,
})

const certSchema = z.object({
  employee_id: z.string().optional(),
  course_id: z.string().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  cert_number: z.string().max(80).nullable().optional(),
  issuer: z.string().max(200).nullable().optional(),
  issued_on: dateOpt,
  expires_on: dateOpt,
  file_name: z.string().max(260).nullable().optional(),
  file_url: z
    .union([z.string().url(), z.literal(''), z.null()])
    .optional(),
})

const careerPathSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  levels: z
    .array(
      z.object({
        t: z.string().min(1).max(120),
        yrs: z.string().max(80).optional(),
        req: z.array(z.string().max(80)).max(20).optional(),
      }),
    )
    .min(1)
    .max(12)
    .optional(),
})

const employeeCareerSchema = z.object({
  employee_id: z.string().min(1),
  path_id: z.string().min(1),
  level_index: z.number().int().min(0).max(20),
})

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

function emptyToNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null || v === '') return null
  return v
}

/* ---------- Courses ---------- */

learning.get('/courses/:id', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT * FROM courses WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first()
  if (!row) return notFound(c, 'Course not found')
  return json(c, { course: row })
})

learning.post('/courses', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được thêm khóa học')
  let body: z.infer<typeof courseSchema>
  try {
    body = courseSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid course payload')
  }
  if (!body.title || !body.course_type) {
    return badRequest(c, 'title and course_type required')
  }
  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO courses (
       id, organization_id, code, title, course_type, level, hours, delivery_mode,
       audience, skill, provider, mandatory, status, start_date, end_date, description
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      emptyToNull(body.code),
      body.title,
      body.course_type,
      emptyToNull(body.level),
      body.hours ?? 0,
      emptyToNull(body.delivery_mode),
      emptyToNull(body.audience),
      emptyToNull(body.skill),
      emptyToNull(body.provider),
      body.mandatory ? 1 : 0,
      body.status ?? 'active',
      emptyToNull(body.start_date),
      emptyToNull(body.end_date),
      emptyToNull(body.description),
    )
    .run()
  await audit(c, user, 'course.create', 'course', id, `Thêm khóa ${body.title}`)
  return json(c, { id }, 201)
})

learning.patch('/courses/:id', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được sửa khóa học')
  const id = c.req.param('id')
  let body: z.infer<typeof courseSchema>
  try {
    body = courseSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid course update')
  }
  const existing = await c.env.DB.prepare(
    `SELECT id FROM courses WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Course not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  if (body.code !== undefined) set('code', emptyToNull(body.code))
  if (body.title !== undefined) set('title', body.title)
  if (body.course_type !== undefined) set('course_type', body.course_type)
  if (body.level !== undefined) set('level', emptyToNull(body.level))
  if (body.hours !== undefined) set('hours', body.hours)
  if (body.delivery_mode !== undefined) {
    set('delivery_mode', emptyToNull(body.delivery_mode))
  }
  if (body.audience !== undefined) set('audience', emptyToNull(body.audience))
  if (body.skill !== undefined) set('skill', emptyToNull(body.skill))
  if (body.provider !== undefined) set('provider', emptyToNull(body.provider))
  if (body.mandatory !== undefined) set('mandatory', body.mandatory ? 1 : 0)
  if (body.status !== undefined) set('status', body.status)
  if (body.start_date !== undefined) set('start_date', emptyToNull(body.start_date))
  if (body.end_date !== undefined) set('end_date', emptyToNull(body.end_date))
  if (body.description !== undefined) {
    set('description', emptyToNull(body.description))
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  values.push(id, user.organizationId)
  await c.env.DB.prepare(
    `UPDATE courses SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()
  await audit(c, user, 'course.update', 'course', id, 'Cập nhật khóa học')
  return json(c, { ok: true })
})

/* ---------- Enrollments ---------- */

learning.get('/enrollments/:id', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT en.*, c.title AS course_title,
            e.full_name AS employee_name, e.code AS employee_code
     FROM enrollments en
     JOIN courses c ON c.id = en.course_id
     JOIN employees e ON e.id = en.employee_id
     WHERE en.organization_id = ? AND en.id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first<{ employee_id: string }>()
  if (!row) return notFound(c, 'Enrollment not found')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  if (!scopeAllowsEmployee(scope, row.employee_id)) {
    return notFound(c, 'Enrollment not found')
  }
  return json(c, { enrollment: row })
})

learning.post('/enrollments', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được ghi danh')
  let body: z.infer<typeof enrollmentSchema>
  try {
    body = enrollmentSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid enrollment payload')
  }
  if (!body.employee_id || !body.course_id) {
    return badRequest(c, 'employee_id and course_id required')
  }
  const progress = body.progress ?? 0
  const completed =
    progress >= 100
      ? (body.completed_on ?? new Date().toISOString().slice(0, 10))
      : emptyToNull(body.completed_on)
  const id = newId()
  try {
    await c.env.DB.prepare(
      `INSERT INTO enrollments (
         id, organization_id, employee_id, course_id, progress, due_on,
         score, enrolled_on, completed_on
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        user.organizationId,
        body.employee_id,
        body.course_id,
        progress,
        emptyToNull(body.due_on),
        body.score ?? null,
        body.enrolled_on ?? new Date().toISOString().slice(0, 10),
        completed,
      )
      .run()
  } catch {
    return badRequest(c, 'Nhân viên đã được ghi danh khóa này')
  }
  await audit(c, user, 'enrollment.create', 'enrollment', id, 'Ghi danh học viên')
  return json(c, { id }, 201)
})

learning.patch('/enrollments/:id', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được cập nhật tiến độ')
  const id = c.req.param('id')
  let body: z.infer<typeof enrollmentSchema>
  try {
    body = enrollmentSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid enrollment update')
  }
  const existing = await c.env.DB.prepare(
    `SELECT id, progress FROM enrollments WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string; progress: number }>()
  if (!existing) return notFound(c, 'Enrollment not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  if (body.progress !== undefined) {
    set('progress', body.progress)
    if (body.progress >= 100 && body.completed_on === undefined) {
      set('completed_on', new Date().toISOString().slice(0, 10))
    }
  }
  if (body.score !== undefined) set('score', body.score)
  if (body.due_on !== undefined) set('due_on', emptyToNull(body.due_on))
  if (body.enrolled_on !== undefined) {
    set('enrolled_on', emptyToNull(body.enrolled_on))
  }
  if (body.completed_on !== undefined) {
    set('completed_on', emptyToNull(body.completed_on))
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  values.push(id, user.organizationId)
  await c.env.DB.prepare(
    `UPDATE enrollments SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()
  await audit(c, user, 'enrollment.update', 'enrollment', id, 'Cập nhật tiến độ học')
  return json(c, { ok: true })
})

/* ---------- Certificates ---------- */

learning.get('/certificates/:id', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT c.*, e.full_name AS employee_name, e.code AS employee_code,
            co.title AS course_title
     FROM certificates c
     JOIN employees e ON e.id = c.employee_id
     LEFT JOIN courses co ON co.id = c.course_id
     WHERE c.organization_id = ? AND c.id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first<{ employee_id: string }>()
  if (!row) return notFound(c, 'Certificate not found')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  if (!scopeAllowsEmployee(scope, row.employee_id)) {
    return notFound(c, 'Certificate not found')
  }
  return json(c, { certificate: row })
})

learning.post('/certificates', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được thêm chứng chỉ')
  let body: z.infer<typeof certSchema>
  try {
    body = certSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid certificate payload')
  }
  if (!body.employee_id || !body.name) {
    return badRequest(c, 'employee_id and name required')
  }
  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO certificates (
       id, organization_id, employee_id, course_id, name, cert_number, issuer,
       issued_on, expires_on, file_name, file_url
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.employee_id,
      emptyToNull(body.course_id),
      body.name,
      emptyToNull(body.cert_number),
      emptyToNull(body.issuer),
      emptyToNull(body.issued_on) ?? new Date().toISOString().slice(0, 10),
      emptyToNull(body.expires_on),
      emptyToNull(body.file_name),
      emptyToNull(typeof body.file_url === 'string' ? body.file_url : null),
    )
    .run()
  await audit(c, user, 'certificate.create', 'certificate', id, `Thêm chứng chỉ ${body.name}`)
  return json(c, { id }, 201)
})

learning.patch('/certificates/:id', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được sửa chứng chỉ')
  const id = c.req.param('id')
  let body: z.infer<typeof certSchema>
  try {
    body = certSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid certificate update')
  }
  const existing = await c.env.DB.prepare(
    `SELECT id FROM certificates WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Certificate not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  if (body.employee_id !== undefined) set('employee_id', body.employee_id)
  if (body.course_id !== undefined) set('course_id', emptyToNull(body.course_id))
  if (body.name !== undefined) set('name', body.name)
  if (body.cert_number !== undefined) {
    set('cert_number', emptyToNull(body.cert_number))
  }
  if (body.issuer !== undefined) set('issuer', emptyToNull(body.issuer))
  if (body.issued_on !== undefined) set('issued_on', emptyToNull(body.issued_on))
  if (body.expires_on !== undefined) {
    set('expires_on', emptyToNull(body.expires_on))
  }
  if (body.file_name !== undefined) set('file_name', emptyToNull(body.file_name))
  if (body.file_url !== undefined) {
    set('file_url', emptyToNull(typeof body.file_url === 'string' ? body.file_url : null))
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  values.push(id, user.organizationId)
  await c.env.DB.prepare(
    `UPDATE certificates SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()
  await audit(c, user, 'certificate.update', 'certificate', id, 'Cập nhật chứng chỉ')
  return json(c, { ok: true })
})

learning.delete('/certificates/:id', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được xóa chứng chỉ')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    `SELECT id FROM certificates WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Certificate not found')
  await c.env.DB.prepare(
    `DELETE FROM certificates WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, user.organizationId)
    .run()
  await audit(c, user, 'certificate.delete', 'certificate', id, 'Xóa chứng chỉ')
  return json(c, { ok: true })
})

/* ---------- Career paths ---------- */

learning.get('/careers/:id', requireModule('learn', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT * FROM career_paths WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first()
  if (!row) return notFound(c, 'Career path not found')
  return json(c, { path: row })
})

learning.post('/careers', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được thêm lộ trình')
  let body: z.infer<typeof careerPathSchema>
  try {
    body = careerPathSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid career path payload')
  }
  if (!body.name || !body.levels?.length) {
    return badRequest(c, 'name and levels required')
  }
  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO career_paths (id, organization_id, name, levels_json)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(id, user.organizationId, body.name, JSON.stringify(body.levels))
    .run()
  await audit(c, user, 'career.create', 'career_path', id, `Thêm lộ trình ${body.name}`)
  return json(c, { id }, 201)
})

learning.patch('/careers/:id', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được sửa lộ trình')
  const id = c.req.param('id')
  let body: z.infer<typeof careerPathSchema>
  try {
    body = careerPathSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid career path update')
  }
  const existing = await c.env.DB.prepare(
    `SELECT id FROM career_paths WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Career path not found')

  const fields: string[] = []
  const values: unknown[] = []
  if (body.name !== undefined) {
    fields.push('name = ?')
    values.push(body.name)
  }
  if (body.levels !== undefined) {
    fields.push('levels_json = ?')
    values.push(JSON.stringify(body.levels))
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  values.push(id, user.organizationId)
  await c.env.DB.prepare(
    `UPDATE career_paths SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()
  await audit(c, user, 'career.update', 'career_path', id, 'Cập nhật lộ trình')
  return json(c, { ok: true })
})

learning.put('/employee-careers', requireModule('learn', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được gán lộ trình')
  }
  let body: z.infer<typeof employeeCareerSchema>
  try {
    body = employeeCareerSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid employee career payload')
  }
  const path = await c.env.DB.prepare(
    `SELECT id FROM career_paths WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, body.path_id)
    .first()
  if (!path) return badRequest(c, 'Lộ trình không tồn tại')
  const emp = await c.env.DB.prepare(
    `SELECT id FROM employees WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, body.employee_id)
    .first()
  if (!emp) return badRequest(c, 'Nhân viên không tồn tại')

  await c.env.DB.prepare(
    `INSERT INTO employee_careers (employee_id, organization_id, path_id, level_index)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(employee_id) DO UPDATE SET
       path_id = excluded.path_id,
       level_index = excluded.level_index,
       organization_id = excluded.organization_id`,
  )
    .bind(body.employee_id, user.organizationId, body.path_id, body.level_index)
    .run()
  await audit(
    c,
    user,
    'employee_career.upsert',
    'employee_career',
    body.employee_id,
    'Gán lộ trình nghề nghiệp',
  )
  return json(c, { ok: true })
})

export default learning
