import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const leave = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

leave.use('*', requireAuth)

function isHrAdmin(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

const decideSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reject_note: z.string().max(1000).optional(),
})

const quotaSchema = z.object({
  employee_id: z.string().optional(),
  year: z.number().int().min(2020).max(2100),
  days: z.number().min(-30).max(60),
  reason: z.string().min(1).max(500),
})

leave.patch('/requests/:id', requireModule('leave', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) return forbidden(c, 'Chỉ Admin / Super Admin được duyệt phép')

  const id = c.req.param('id')
  let body: z.infer<typeof decideSchema>
  try {
    body = decideSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid decision')
  }

  const row = await c.env.DB.prepare(
    `SELECT id, status FROM leave_requests WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string; status: string }>()
  if (!row) return notFound(c, 'Leave request not found')
  if (row.status !== 'pending') {
    return badRequest(c, 'Chỉ duyệt đơn đang chờ (pending)')
  }

  await c.env.DB.prepare(
    `UPDATE leave_requests
     SET status = ?, reject_note = ?, approved_by = ?, approved_at = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(
      body.status,
      body.status === 'rejected' ? (body.reject_note ?? 'Từ chối') : null,
      user.id,
      new Date().toISOString(),
      id,
      user.organizationId,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'leave.decide',
    entityType: 'leave_request',
    entityId: id,
    detail: `${body.status === 'approved' ? 'Duyệt' : 'Từ chối'} nghỉ phép`,
  })

  return json(c, { ok: true })
})

leave.put('/quotas', requireModule('leave', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được chỉnh số ngày phép')
  }

  let body: z.infer<typeof quotaSchema>
  try {
    body = quotaSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid quota payload')
  }
  if (!body.employee_id) return badRequest(c, 'employee_id required')

  const existing = await c.env.DB.prepare(
    `SELECT id FROM leave_adjustments
     WHERE organization_id = ? AND employee_id = ? AND year = ?`,
  )
    .bind(user.organizationId, body.employee_id, body.year)
    .first<{ id: string }>()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE leave_adjustments
       SET days = ?, reason = ?, created_by = ?
       WHERE id = ?`,
    )
      .bind(body.days, body.reason, user.id, existing.id)
      .run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO leave_adjustments (
         id, organization_id, employee_id, year, days, reason, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId(),
        user.organizationId,
        body.employee_id,
        body.year,
        body.days,
        body.reason,
        user.id,
      )
      .run()
  }

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.id,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'leave.quota_update',
    entityType: 'leave_adjustment',
    entityId: body.employee_id,
    detail: `Cập nhật phép ${body.year}: ${body.days} ngày — ${body.reason}`,
  })

  return json(c, { ok: true })
})

leave.patch('/quotas/:id', requireModule('leave', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được chỉnh số ngày phép')
  }
  const id = c.req.param('id')
  const body = z
    .object({
      days: z.number().min(-30).max(60).optional(),
      reason: z.string().min(1).max(500).optional(),
    })
    .parse(await c.req.json())

  const existing = await c.env.DB.prepare(
    `SELECT id FROM leave_adjustments WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Quota not found')

  const fields: string[] = []
  const values: unknown[] = []
  if (body.days !== undefined) {
    fields.push('days = ?')
    values.push(body.days)
  }
  if (body.reason !== undefined) {
    fields.push('reason = ?')
    values.push(body.reason)
  }
  if (fields.length === 0) return badRequest(c, 'No fields')
  fields.push('created_by = ?')
  values.push(user.id, id, user.organizationId)

  await c.env.DB.prepare(
    `UPDATE leave_adjustments SET ${fields.join(', ')}
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(...values)
    .run()

  return json(c, { ok: true })
})

export default leave
