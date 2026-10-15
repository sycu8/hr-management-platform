import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { badRequest, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import {
  employeePhotoKey,
  putDocumentBytes,
  r2ObjectResponse,
} from '../lib/r2.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import {
  getPermissionLevel,
  requireModule,
  requireSelfOrElevated,
} from '../middleware/rbac.ts'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải dạng YYYY-MM-DD')
  .nullable()
  .optional()

const employeeFieldsSchema = z.object({
  code: z.string().min(1).max(32).optional(),
  full_name: z.string().min(1).max(200).optional(),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  phone: z.string().max(40).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  birth_date: dateStr,
  address: z.string().max(500).nullable().optional(),
  department: z.string().min(1).max(120).optional(),
  title: z.string().min(1).max(120).optional(),
  level: z.number().int().min(0).max(3).optional(),
  manager_id: z.string().nullable().optional(),
  base_salary: z.number().int().min(0).max(500_000_000).optional(),
  dependents: z.number().int().min(0).max(20).optional(),
  status: z.enum(['active', 'left']).optional(),
  joined_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  left_on: dateStr,
  contract_type: z.string().min(1).max(120).optional(),
  contract_start: dateStr,
  contract_end: dateStr,
  skills: z.array(z.string().min(1).max(80)).max(30).optional(),
})

const createEmployeeSchema = employeeFieldsSchema.extend({
  code: z.string().min(1).max(32),
  full_name: z.string().min(1).max(200),
  department: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  joined_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contract_type: z.string().min(1).max(120),
})

type EmployeeListRow = {
  id: string
  code: string
  full_name: string
  email: string | null
  phone: string | null
  gender: string | null
  department: string
  title: string
  level: number
  status: string
  manager_id: string | null
  joined_on: string
  contract_type: string
  contract_end: string | null
  photo_r2_key: string | null
}

type EmployeeDetailRow = EmployeeListRow & {
  birth_date: string | null
  address: string | null
  left_on: string | null
  contract_start: string | null
  dependents: number
  base_salary: number
  skills_json: string
  photo_file_name: string | null
  photo_content_type: string | null
  photo_size_bytes: number
}

const employees = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

employees.use('*', requireAuth)

employees.get('/', requireModule('emp', 1), async (c) => {
  const user = c.get('user')
  const status = c.req.query('status') ?? 'active'
  const limit = Math.min(Number(c.req.query('limit') ?? 100) || 100, 300)
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)
  const statusFilter = status === 'all' ? null : status

  const { results } = await c.env.DB.prepare(
    `SELECT id, code, full_name, email, phone, gender, department, title, level,
            status, manager_id, joined_on, contract_type, contract_end, photo_r2_key
     FROM employees
     WHERE organization_id = ?
       AND (? IS NULL OR status = ?)
     ORDER BY code
     LIMIT ? OFFSET ?`,
  )
    .bind(user.organizationId, statusFilter, statusFilter, limit, offset)
    .all<EmployeeListRow>()

  const items = (results ?? []).map(({ photo_r2_key, ...rest }) => ({
    ...rest,
    has_photo: Boolean(photo_r2_key),
  }))

  return json(c, { items, limit, offset })
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
    const empLevel = await getPermissionLevel(c.env.DB, user, 'emp')

    const row = await c.env.DB.prepare(
      `SELECT id, code, full_name, email, phone, gender, birth_date, address,
              department, title, level, status, manager_id, joined_on, left_on,
              contract_type, contract_start, contract_end, dependents,
              base_salary, skills_json, photo_r2_key, photo_file_name,
              photo_content_type, photo_size_bytes
       FROM employees
       WHERE organization_id = ? AND id = ?
       LIMIT 1`,
    )
      .bind(user.organizationId, id)
      .first<EmployeeDetailRow>()

    if (!row) return notFound(c, 'Employee not found')

    let skills: string[] = []
    try {
      const parsed = JSON.parse(row.skills_json || '[]') as unknown
      skills = Array.isArray(parsed)
        ? parsed.filter((x): x is string => typeof x === 'string')
        : []
    } catch {
      skills = []
    }

    const {
      base_salary,
      skills_json: _sj,
      photo_r2_key,
      photo_file_name,
      photo_content_type,
      photo_size_bytes,
      ...rest
    } = row
    const employee = {
      ...rest,
      skills,
      has_photo: Boolean(photo_r2_key),
      photo_file_name: photo_file_name ?? null,
      photo_content_type: photo_content_type ?? null,
      photo_size_bytes: photo_size_bytes ?? 0,
      // Salary only for write-capable HR (admin / elevated)
      ...(empLevel >= 2 ? { base_salary } : {}),
    }

    return json(c, { employee })
  },
)

/** Serve employee portrait from R2 (authenticated). */
employees.get(
  '/:id/photo',
  requireSelfOrElevated({
    moduleKey: 'emp',
    getEmployeeId: (ctx) => ctx.req.param('id'),
  }),
  async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const row = await c.env.DB.prepare(
      `SELECT photo_r2_key, photo_file_name FROM employees
       WHERE organization_id = ? AND id = ? LIMIT 1`,
    )
      .bind(user.organizationId, id)
      .first<{ photo_r2_key: string | null; photo_file_name: string | null }>()

    if (!row?.photo_r2_key) return notFound(c, 'Photo not found')
    const object = await c.env.DOCUMENTS.get(row.photo_r2_key)
    if (!object) return notFound(c, 'Photo missing in R2')

    return r2ObjectResponse(
      object,
      row.photo_file_name || 'photo.jpg',
      'inline',
    )
  },
)

/** Upload / replace employee portrait → R2; D1 keeps metadata only. */
employees.post('/:id/photo', requireModule('emp', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    `SELECT id, photo_r2_key FROM employees
     WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string; photo_r2_key: string | null }>()
  if (!existing) return notFound(c, 'Employee not found')

  const form = await c.req.parseBody({ all: true })
  const raw = form['file']
  const file = Array.isArray(raw) ? raw[0] : raw
  if (!(file instanceof File)) {
    return badRequest(c, 'Missing multipart field "file"')
  }
  if (file.size <= 0) return badRequest(c, 'Empty file')
  if (file.size > MAX_PHOTO_BYTES) {
    return badRequest(c, `Ảnh tối đa ${MAX_PHOTO_BYTES / (1024 * 1024)}MB`)
  }
  const contentType = file.type || 'application/octet-stream'
  if (!PHOTO_MIME.has(contentType)) {
    return badRequest(c, 'Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF')
  }

  const photoId = newId()
  const fileName = file.name || 'photo.jpg'
  const r2Key = employeePhotoKey(
    user.organizationId,
    id,
    photoId,
    fileName,
  )
  const bytes = await file.arrayBuffer()
  await putDocumentBytes(c.env.DOCUMENTS, r2Key, bytes, contentType)

  if (existing.photo_r2_key) {
    try {
      await c.env.DOCUMENTS.delete(existing.photo_r2_key)
    } catch (err) {
      console.warn('photo_r2_delete_failed', existing.photo_r2_key, err)
    }
  }

  await c.env.DB.prepare(
    `UPDATE employees
     SET photo_r2_key = ?, photo_file_name = ?, photo_content_type = ?,
         photo_size_bytes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(r2Key, fileName, contentType, file.size, id, user.organizationId)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'employee.photo.upload',
    entityType: 'employee',
    entityId: id,
    detail: `Uploaded photo ${fileName} (${r2Key})`,
  })

  return json(c, { ok: true, has_photo: true, file_name: fileName })
})

employees.delete('/:id/photo', requireModule('emp', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    `SELECT photo_r2_key FROM employees
     WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<{ photo_r2_key: string | null }>()
  if (!existing) return notFound(c, 'Employee not found')
  if (!existing.photo_r2_key) return json(c, { ok: true })

  try {
    await c.env.DOCUMENTS.delete(existing.photo_r2_key)
  } catch (err) {
    console.warn('photo_r2_delete_failed', existing.photo_r2_key, err)
  }

  await c.env.DB.prepare(
    `UPDATE employees
     SET photo_r2_key = NULL, photo_file_name = NULL, photo_content_type = NULL,
         photo_size_bytes = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, user.organizationId)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'employee.photo.delete',
    entityType: 'employee',
    entityId: id,
    detail: 'Removed employee photo',
  })

  return json(c, { ok: true })
})

/** Create employee — Admin / Super Admin (emp write). */
employees.post('/', requireModule('emp', 2), async (c) => {
  const user = c.get('user')
  let body: z.infer<typeof createEmployeeSchema>
  try {
    body = createEmployeeSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid employee payload')
  }

  if (body.manager_id) {
    const mgr = await c.env.DB.prepare(
      `SELECT id FROM employees WHERE organization_id = ? AND id = ? LIMIT 1`,
    )
      .bind(user.organizationId, body.manager_id)
      .first()
    if (!mgr) return badRequest(c, 'Manager not found')
  }

  const id = newId()
  const email =
    body.email === '' || body.email === undefined ? null : body.email

  await c.env.DB.prepare(
    `INSERT INTO employees (
       id, organization_id, code, full_name, email, phone, gender, birth_date, address,
       department, title, level, manager_id, base_salary, dependents, status,
       joined_on, left_on, contract_type, contract_start, contract_end, skills_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      body.code,
      body.full_name,
      email,
      body.phone ?? null,
      body.gender ?? null,
      body.birth_date ?? null,
      body.address ?? null,
      body.department,
      body.title,
      body.level ?? 0,
      body.manager_id ?? null,
      body.base_salary ?? 0,
      body.dependents ?? 0,
      body.status ?? 'active',
      body.joined_on,
      body.left_on ?? null,
      body.contract_type,
      body.contract_start ?? null,
      body.contract_end ?? null,
      JSON.stringify(body.skills ?? []),
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'employee.create',
    entityType: 'employee',
    entityId: id,
    detail: `Tạo hồ sơ ${body.code} — ${body.full_name}`,
  })

  return json(c, { id }, 201)
})

/** Update employee — Admin / Super Admin (emp write). */
employees.patch('/:id', requireModule('emp', 2), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  let body: z.infer<typeof employeeFieldsSchema>
  try {
    body = employeeFieldsSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid employee update')
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM employees WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string }>()
  if (!existing) return notFound(c, 'Employee not found')

  if (body.manager_id) {
    if (body.manager_id === id) {
      return badRequest(c, 'Không thể tự làm quản lý trực tiếp của mình')
    }
    const mgr = await c.env.DB.prepare(
      `SELECT id FROM employees WHERE organization_id = ? AND id = ? LIMIT 1`,
    )
      .bind(user.organizationId, body.manager_id)
      .first()
    if (!mgr) return badRequest(c, 'Manager not found')
  }

  const fields: string[] = []
  const values: unknown[] = []

  const set = (col: string, val: unknown) => {
    fields.push(`${col} = ?`)
    values.push(val)
  }

  if (body.code !== undefined) set('code', body.code)
  if (body.full_name !== undefined) set('full_name', body.full_name)
  if (body.email !== undefined) {
    set('email', body.email === '' ? null : body.email)
  }
  if (body.phone !== undefined) set('phone', body.phone)
  if (body.gender !== undefined) set('gender', body.gender)
  if (body.birth_date !== undefined) set('birth_date', body.birth_date)
  if (body.address !== undefined) set('address', body.address)
  if (body.department !== undefined) set('department', body.department)
  if (body.title !== undefined) set('title', body.title)
  if (body.level !== undefined) set('level', body.level)
  if (body.manager_id !== undefined) set('manager_id', body.manager_id)
  if (body.base_salary !== undefined) set('base_salary', body.base_salary)
  if (body.dependents !== undefined) set('dependents', body.dependents)
  if (body.status !== undefined) set('status', body.status)
  if (body.joined_on !== undefined) set('joined_on', body.joined_on)
  if (body.left_on !== undefined) set('left_on', body.left_on)
  if (body.contract_type !== undefined) set('contract_type', body.contract_type)
  if (body.contract_start !== undefined) {
    set('contract_start', body.contract_start)
  }
  if (body.contract_end !== undefined) set('contract_end', body.contract_end)
  if (body.skills !== undefined) set('skills_json', JSON.stringify(body.skills))

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
