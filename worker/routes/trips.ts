import { Hono } from 'hono'
import { z } from 'zod'
import { estimateTravel } from '../../shared/domain/travel.ts'
import { GOLDEN_TRAVEL_POLICY } from '../../shared/fixtures/golden.ts'
import type { Env } from '../env.ts'
import { badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { writeAuditEvent } from '../lib/audit.ts'
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
  advance: number
  transport: string
  distance_km: number
}

const trips = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

trips.use('*', requireAuth)

function isHrAdmin(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

const patchSchema = z.object({
  origin: z.string().min(1).max(120).optional(),
  destination: z.string().min(1).max(120).optional(),
  zone: z.string().min(1).max(20).optional(),
  purpose: z.string().min(1).max(500).optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  distance_km: z.number().min(0).optional(),
  transport: z.string().max(80).optional(),
  transport_est: z.number().int().min(0).optional(),
  other_est: z.number().int().min(0).optional(),
  other_note: z.string().max(500).nullable().optional(),
  hotel_mode: z.enum(['actual', 'flat', 'none']).optional(),
  hotel_price: z.number().int().min(0).optional(),
  meal: z.enum(['none', 'partial', 'full']).optional(),
  advance: z.number().int().min(0).optional(),
  status: z.enum(['draft', 'pm', 'ph', 'ap', 'st', 'ok', 'rj']).optional(),
  reject_note: z.string().max(500).nullable().optional(),
  actual_json: z.string().nullable().optional(),
  estimate_json: z.string().nullable().optional(),
})

const createSchema = z.object({
  employee_id: z.string().min(1).max(64),
  origin: z.string().min(1).max(120),
  destination: z.string().min(1).max(120),
  zone: z.string().min(1).max(20),
  purpose: z.string().min(1).max(500),
  start_at: z.string().min(1),
  end_at: z.string().min(1),
  distance_km: z.number().min(0).default(0),
  transport: z.string().max(80).default(''),
  transport_est: z.number().int().min(0).default(0),
  other_est: z.number().int().min(0).default(0),
  other_note: z.string().max(500).nullable().optional(),
  hotel_mode: z.enum(['actual', 'flat', 'none']).default('actual'),
  hotel_price: z.number().int().min(0).default(0),
  meal: z.enum(['none', 'partial', 'full']).default('none'),
  advance: z.number().int().min(0).default(0),
  status: z.enum(['draft', 'pm']).default('draft'),
  estimate_json: z.string().nullable().optional(),
})

function buildEstimate(body: {
  zone: string
  start_at: string
  end_at: string
  distance_km: number
  meal: string
  hotel_mode: string
  hotel_price: number
  transport_est: number
  other_est: number
  level: number
}): string {
  const r = estimateTravel(
    {
      zone: body.zone,
      start: body.start_at,
      end: body.end_at,
      distance: body.distance_km,
      meal: body.meal,
      hotelMode: body.hotel_mode,
      hotelPrice: body.hotel_price,
      transportEst: body.transport_est,
      otherEst: body.other_est,
    },
    body.level,
    GOLDEN_TRAVEL_POLICY,
  )
  return JSON.stringify({
    days: r.days,
    nights: r.nights,
    perDiem: r.perDiem,
    hotel: r.hotel,
    local: r.local,
    transport: r.transport,
    other: r.other,
    total: r.total,
    valid: r.valid,
  })
}

trips.get('/', requireModule('trip', 1), async (c) => {
  const user = c.get('user')
  const status = c.req.query('status')
  const pipeline = c.req.query('pipeline') // approve | settle
  const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200)
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)

  const employeeFilter =
    user.accountType === 'user' && user.employeeId ? user.employeeId : null

  let statusClause = 'AND (? IS NULL OR status = ?)'
  const binds: unknown[] = [user.organizationId]

  if (pipeline === 'approve') {
    statusClause = `AND status IN ('pm','ph')`
  } else if (pipeline === 'settle') {
    statusClause = `AND status IN ('st','ap')`
  } else {
    binds.push(status ?? null, status ?? null)
  }

  binds.push(employeeFilter, employeeFilter, limit, offset)

  const { results } = await c.env.DB.prepare(
    `SELECT id, code, employee_id, origin, destination, zone, start_at, end_at,
            status, purpose, advance, transport, distance_km
     FROM trips
     WHERE organization_id = ?
       ${statusClause}
       AND (? IS NULL OR employee_id = ?)
     ORDER BY start_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds)
    .all<TripListRow>()

  return json(c, { items: results ?? [], limit, offset })
})

trips.post('/', requireModule('trip', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được tạo đề nghị công tác')
  }
  let body: z.infer<typeof createSchema>
  try {
    body = createSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid trip payload')
  }

  const emp = await c.env.DB.prepare(
    `SELECT id, level FROM employees WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, body.employee_id)
    .first<{ id: string; level: number }>()
  if (!emp) return badRequest(c, 'Nhân viên không hợp lệ')

  const year = new Date().getFullYear()
  const last = await c.env.DB.prepare(
    `SELECT code FROM trips
     WHERE organization_id = ? AND code LIKE ?
     ORDER BY code DESC LIMIT 1`,
  )
    .bind(user.organizationId, `CT-${year}-%`)
    .first<{ code: string }>()
  let seq = 1
  if (last?.code) {
    const m = /CT-\d{4}-(\d+)/.exec(last.code)
    if (m) seq = Number(m[1]) + 1
  }
  const code = `CT-${year}-${String(seq).padStart(4, '0')}`
  const id = newId()
  const estimate =
    body.estimate_json ??
    buildEstimate({
      ...body,
      level: emp.level,
    })

  await c.env.DB.prepare(
    `INSERT INTO trips (
       id, organization_id, code, employee_id, origin, destination, zone, purpose,
       start_at, end_at, distance_km, transport, transport_est, other_est, other_note,
       hotel_mode, hotel_price, meal, advance, status, estimate_json, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      code,
      body.employee_id,
      body.origin,
      body.destination,
      body.zone,
      body.purpose,
      body.start_at,
      body.end_at,
      body.distance_km,
      body.transport,
      body.transport_est,
      body.other_est,
      body.other_note ?? null,
      body.hotel_mode,
      body.hotel_price,
      body.meal,
      body.advance,
      body.status,
      estimate,
      user.id,
    )
    .run()

  await c.env.DB.prepare(
    `INSERT INTO trip_history (id, trip_id, at, actor_role, actor_user_id, text)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      id,
      new Date().toISOString(),
      user.accountType,
      user.id,
      body.status === 'pm'
        ? `Tạo và gửi duyệt ${code}`
        : `Tạo nháp ${code}`,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'trip.create',
    entityType: 'trip',
    entityId: id,
    detail: `Tạo ${code}`,
  })

  return json(c, { ok: true, id, code, status: body.status })
})

trips.get('/:id', requireModule('trip', 1), async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT * FROM trips WHERE organization_id = ? AND id = ? LIMIT 1`,
  )
    .bind(user.organizationId, c.req.param('id'))
    .first()
  if (!row) return notFound(c, 'Trip not found')
  if (
    user.accountType === 'user' &&
    user.employeeId &&
    row.employee_id !== user.employeeId
  ) {
    return forbidden(c, 'Not your trip')
  }
  return json(c, { trip: row })
})

trips.patch('/:id', requireModule('trip', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được chỉnh sửa công tác')
  }
  const id = c.req.param('id')
  let body: z.infer<typeof patchSchema>
  try {
    body = patchSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid trip update')
  }

  const existing = await c.env.DB.prepare(
    `SELECT t.id, t.status, t.zone, t.start_at, t.end_at, t.distance_km,
            t.meal, t.hotel_mode, t.hotel_price, t.transport_est, t.other_est,
            e.level AS emp_level
     FROM trips t
     JOIN employees e ON e.id = t.employee_id
     WHERE t.organization_id = ? AND t.id = ?`,
  )
    .bind(user.organizationId, id)
    .first<{
      id: string
      status: string
      zone: string
      start_at: string
      end_at: string
      distance_km: number
      meal: string
      hotel_mode: string
      hotel_price: number
      transport_est: number
      other_est: number
      emp_level: number
    }>()
  if (!existing) return notFound(c, 'Trip not found')

  const fields: string[] = []
  const values: unknown[] = []
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`)
    values.push(v)
  }
  for (const key of Object.keys(body) as (keyof typeof body)[]) {
    if (body[key] !== undefined) set(key, body[key])
  }
  if (body.estimate_json === undefined) {
    const merged = {
      zone: body.zone ?? existing.zone,
      start_at: body.start_at ?? existing.start_at,
      end_at: body.end_at ?? existing.end_at,
      distance_km: body.distance_km ?? existing.distance_km,
      meal: body.meal ?? existing.meal,
      hotel_mode: body.hotel_mode ?? existing.hotel_mode,
      hotel_price: body.hotel_price ?? existing.hotel_price,
      transport_est: body.transport_est ?? existing.transport_est,
      other_est: body.other_est ?? existing.other_est,
      level: existing.emp_level,
    }
    set('estimate_json', buildEstimate(merged))
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
  values.push(id, user.organizationId)

  await c.env.DB.prepare(
    `UPDATE trips SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()

  await c.env.DB.prepare(
    `INSERT INTO trip_history (id, trip_id, at, actor_role, actor_user_id, text)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      id,
      new Date().toISOString(),
      user.accountType,
      user.id,
      `Cập nhật đề nghị: ${Object.keys(body).join(', ')}`,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'trip.update',
    entityType: 'trip',
    entityId: id,
    detail: `Sửa công tác`,
  })

  return json(c, { ok: true })
})

trips.post('/:id/approve', requireModule('trip', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được phê duyệt')
  const id = c.req.param('id')
  const body = z
    .object({
      decision: z.enum(['approve', 'reject']),
      note: z.string().max(500).optional(),
    })
    .parse(await c.req.json())

  const row = await c.env.DB.prepare(
    `SELECT id, status, code FROM trips WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string; status: string; code: string }>()
  if (!row) return notFound(c, 'Trip not found')
  if (!['draft', 'pm', 'ph'].includes(row.status)) {
    return badRequest(c, 'Trạng thái hiện tại không thể phê duyệt')
  }

  const next = body.decision === 'approve' ? 'ap' : 'rj'
  await c.env.DB.prepare(
    `UPDATE trips
     SET status = ?, reject_note = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(
      next,
      body.decision === 'reject' ? (body.note ?? 'Từ chối') : null,
      id,
    )
    .run()

  await c.env.DB.prepare(
    `INSERT INTO trip_history (id, trip_id, at, actor_role, actor_user_id, text)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      id,
      new Date().toISOString(),
      user.accountType,
      user.id,
      body.decision === 'approve'
        ? 'Admin phê duyệt — chờ đi / tạm ứng'
        : `Từ chối: ${body.note ?? ''}`,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'trip.approve',
    entityType: 'trip',
    entityId: id,
    detail: `${body.decision} ${row.code}`,
  })

  return json(c, { ok: true, status: next })
})

trips.post('/:id/settle', requireModule('trip', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được quyết toán')
  const id = c.req.param('id')
  const body = z
    .object({
      hotel: z.number().int().min(0).optional(),
      transport: z.number().int().min(0).optional(),
      other: z.number().int().min(0).optional(),
      note: z.string().max(500).optional(),
      total: z.number().int().min(0).optional(),
    })
    .parse(await c.req.json().catch(() => ({})))

  const row = await c.env.DB.prepare(
    `SELECT id, status, code, actual_json, estimate_json FROM trips
     WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first<{
      id: string
      status: string
      code: string
      actual_json: string | null
      estimate_json: string | null
    }>()
  if (!row) return notFound(c, 'Trip not found')
  if (!['ap', 'st'].includes(row.status)) {
    return badRequest(c, 'Chỉ quyết toán chuyến đã duyệt / đang quyết toán')
  }

  let prev: Record<string, unknown> = {}
  try {
    prev = row.actual_json ? (JSON.parse(row.actual_json) as Record<string, unknown>) : {}
  } catch {
    prev = {}
  }
  const actual = {
    ...prev,
    hotel: body.hotel ?? prev.hotel ?? 0,
    transport: body.transport ?? prev.transport ?? 0,
    other: body.other ?? prev.other ?? 0,
    note: body.note ?? prev.note ?? '',
    total: body.total ?? prev.total ?? 0,
    settled_at: new Date().toISOString(),
  }

  await c.env.DB.prepare(
    `UPDATE trips
     SET status = 'ok', actual_json = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(JSON.stringify(actual), id)
    .run()

  await c.env.DB.prepare(
    `INSERT INTO trip_history (id, trip_id, at, actor_role, actor_user_id, text)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      id,
      new Date().toISOString(),
      user.accountType,
      user.id,
      `Quyết toán hoàn tất${body.total != null ? ` — ${body.total.toLocaleString('vi-VN')} ₫` : ''}`,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'trip.settle',
    entityType: 'trip',
    entityId: id,
    detail: `Quyết toán ${row.code}`,
  })

  return json(c, { ok: true, status: 'ok' })
})

export default trips
