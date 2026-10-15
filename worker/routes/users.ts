import { Hono } from 'hono'
import { z } from 'zod'
import type { AccountType, Capability, Env } from '../env.ts'
import { apiError, badRequest, forbidden, json } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { hashPassword } from '../lib/password.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireActorAdmin } from '../middleware/rbac.ts'

const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  accountType: z.enum(['admin', 'user']),
  temporaryPassword: z.string().min(8),
  employeeId: z.string().nullable().optional(),
  capabilities: z
    .array(
      z.object({
        capability: z.enum([
          'dashboard',
          'employees',
          'recruiting',
          'leave',
          'travel',
          'payroll',
          'benefits',
          'performance',
          'learning',
          'policies',
        ]),
        level: z.union([z.literal(1), z.literal(2)]),
      }),
    )
    .optional(),
})

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
})

const patchUserSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  employeeId: z.string().nullable().optional(),
})

const users = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

users.use('*', requireAuth)

users.get('/', requireActorAdmin(), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, email, display_name, account_type, employee_id, is_active,
            must_reset_password, last_login_at, created_at
     FROM users
     WHERE organization_id = ?
     ORDER BY account_type, email`,
  )
    .bind(user.organizationId)
    .all()

  return json(c, { items: results ?? [] })
})

users.post('/', requireActorAdmin(), async (c) => {
  const actor = c.get('user')
  // Resolve real actor type (ignore view-as)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM sessions WHERE id = ?`,
  )
    .bind(actor.sessionId)
    .first<{ user_id: string }>()
  const actorRow = session
    ? await c.env.DB.prepare(
        `SELECT account_type, email FROM users WHERE id = ?`,
      )
        .bind(session.user_id)
        .first<{ account_type: AccountType; email: string }>()
    : null

  if (!actorRow) return forbidden(c, 'Actor missing')

  let body: z.infer<typeof createUserSchema>
  try {
    body = createUserSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid create-user payload')
  }

  // Admin cannot create super_admin (schema already blocks). Cannot create admin? User said admin can create accounts — allow admin+user.
  if (body.accountType === 'admin' && actorRow.account_type !== 'super_admin') {
    // HR manager creating another admin — allow per "tạo tài khoản"
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM users WHERE organization_id = ? AND lower(email) = lower(?)`,
  )
    .bind(actor.organizationId, body.email)
    .first()
  if (existing) return badRequest(c, 'Email đã tồn tại')

  const id = newId()
  const { hash, salt } = await hashPassword(body.temporaryPassword)
  // Map legacy role column for compatibility
  const legacyRole =
    body.accountType === 'admin' ? 'hr' : 'employee'

  await c.env.DB.prepare(
    `INSERT INTO users (
       id, organization_id, email, display_name, role, account_type,
       employee_id, is_active, password_hash, password_salt, must_reset_password
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 1)`,
  )
    .bind(
      id,
      actor.organizationId,
      body.email.toLowerCase(),
      body.displayName,
      legacyRole,
      body.accountType,
      body.employeeId ?? null,
      hash,
      salt,
    )
    .run()

  if (body.accountType === 'user' && body.capabilities?.length) {
    for (const cap of body.capabilities) {
      await c.env.DB.prepare(
        `INSERT INTO user_capabilities (user_id, capability, level) VALUES (?, ?, ?)`,
      )
        .bind(id, cap.capability as Capability, cap.level)
        .run()
    }
  }

  await writeAuditEvent(c.env.DB, {
    organizationId: actor.organizationId,
    actorUserId: session!.user_id,
    actorRole: actorRow.account_type,
    actorEmail: actorRow.email,
    action: 'users.create',
    entityType: 'user',
    entityId: id,
    detail: `Created ${body.accountType} ${body.email}`,
  })

  return json(c, { id, email: body.email.toLowerCase() }, 201)
})

users.patch('/:id', requireActorAdmin(), async (c) => {
  const actor = c.get('user')
  const targetId = c.req.param('id')
  let body: z.infer<typeof patchUserSchema>
  try {
    body = patchUserSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid user update')
  }

  const target = await c.env.DB.prepare(
    `SELECT id, organization_id, account_type, email FROM users WHERE id = ?`,
  )
    .bind(targetId)
    .first<{
      id: string
      organization_id: string
      account_type: AccountType
      email: string
    }>()

  if (!target || target.organization_id !== actor.organizationId) {
    return apiError(c, 404, 'not_found', 'User not found')
  }

  // Resolve real actor type (ignore view-as)
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM sessions WHERE id = ?`,
  )
    .bind(actor.sessionId)
    .first<{ user_id: string }>()
  const actorRow = session
    ? await c.env.DB.prepare(`SELECT account_type, email FROM users WHERE id = ?`)
        .bind(session.user_id)
        .first<{ account_type: AccountType; email: string }>()
    : null
  if (!actorRow) return forbidden(c, 'Actor missing')

  if (
    target.account_type === 'super_admin' &&
    actorRow.account_type !== 'super_admin'
  ) {
    return forbidden(c, 'Cannot edit super admin')
  }

  const fields: string[] = []
  const values: unknown[] = []
  if (body.displayName !== undefined) {
    fields.push('display_name = ?')
    values.push(body.displayName)
  }
  if (body.isActive !== undefined) {
    fields.push('is_active = ?')
    values.push(body.isActive ? 1 : 0)
  }
  if (body.employeeId !== undefined) {
    fields.push('employee_id = ?')
    values.push(body.employeeId)
  }
  if (fields.length === 0) return badRequest(c, 'No fields to update')

  fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
  values.push(targetId)

  await c.env.DB.prepare(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
  )
    .bind(...values)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: actor.organizationId,
    actorUserId: session!.user_id,
    actorRole: actorRow.account_type,
    actorEmail: actorRow.email,
    action: 'users.update',
    entityType: 'user',
    entityId: targetId,
    detail: `Updated ${target.email}: ${Object.keys(body).join(', ')}`,
  })

  return json(c, { ok: true })
})

users.post('/:id/reset-password', requireActorAdmin(), async (c) => {
  const actor = c.get('user')
  const targetId = c.req.param('id')

  let body: z.infer<typeof resetPasswordSchema>
  try {
    body = resetPasswordSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid reset payload')
  }

  const target = await c.env.DB.prepare(
    `SELECT id, organization_id, account_type, email FROM users WHERE id = ?`,
  )
    .bind(targetId)
    .first<{
      id: string
      organization_id: string
      account_type: AccountType
      email: string
    }>()

  if (!target || target.organization_id !== actor.organizationId) {
    return apiError(c, 404, 'not_found', 'User not found')
  }

  // Admin cannot reset super_admin passwords
  if (target.account_type === 'super_admin') {
    const session = await c.env.DB.prepare(
      `SELECT user_id FROM sessions WHERE id = ?`,
    )
      .bind(actor.sessionId)
      .first<{ user_id: string }>()
    const actorType = session
      ? await c.env.DB.prepare(
          `SELECT account_type FROM users WHERE id = ?`,
        )
          .bind(session.user_id)
          .first<{ account_type: AccountType }>()
      : null
    if (actorType?.account_type !== 'super_admin') {
      return forbidden(c, 'Cannot reset super admin password')
    }
  }

  const { hash, salt } = await hashPassword(body.newPassword)
  await c.env.DB.prepare(
    `UPDATE users
     SET password_hash = ?, password_salt = ?, must_reset_password = 1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(hash, salt, targetId)
    .run()

  // Drop existing sessions for that user
  await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`)
    .bind(targetId)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: actor.organizationId,
    actorUserId: actor.id,
    action: 'users.reset_password',
    entityType: 'user',
    entityId: targetId,
    detail: `Password reset for ${target.email}`,
  })

  return json(c, { ok: true })
})

export default users
