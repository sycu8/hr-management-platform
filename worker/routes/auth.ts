import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env.ts'
import { apiError, badRequest, json, unauthorized } from '../lib/http.ts'
import { hashPassword, verifyPassword } from '../lib/password.ts'
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
  parseCookies,
  SESSION_COOKIE,
} from '../lib/session.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import {
  listAllowedModules,
  requireActorSuperAdmin,
} from '../middleware/rbac.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { verifyTurnstileToken } from '../lib/turnstile.ts'

const LOGIN_TURNSTILE_ACTION = 'login'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1).max(2048),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

type UserAuthRow = {
  id: string
  organization_id: string
  email: string
  display_name: string
  account_type: 'super_admin' | 'admin' | 'user'
  employee_id: string | null
  is_active: number
  must_reset_password: number
  password_hash: string | null
  password_salt: string | null
}

const auth = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

function isSecureRequest(c: { req: { url: string } }): boolean {
  return new URL(c.req.url).protocol === 'https:'
}

auth.get('/turnstile', (c) => {
  const siteKey = c.env.TURNSTILE_SITE_KEY
  if (!siteKey || siteKey.startsWith('REPLACE_')) {
    return apiError(c, 503, 'misconfigured', 'Turnstile site key missing')
  }
  return json(c, { siteKey, action: LOGIN_TURNSTILE_ACTION })
})

auth.post('/login', async (c) => {
  let body: z.infer<typeof loginSchema>
  try {
    body = loginSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid login payload')
  }

  const turnstile = await verifyTurnstileToken({
    env: c.env,
    token: body.turnstileToken,
    expectedAction: LOGIN_TURNSTILE_ACTION,
    remoteIp: c.req.header('CF-Connecting-IP'),
  })
  if (!turnstile.ok) {
    return unauthorized(c, 'Xác minh bảo mật thất bại. Thử lại.')
  }

  const row = await c.env.DB.prepare(
    `SELECT id, organization_id, email, display_name, account_type, employee_id,
            is_active, must_reset_password, password_hash, password_salt
     FROM users WHERE lower(email) = lower(?) LIMIT 1`,
  )
    .bind(body.email.trim())
    .first<UserAuthRow>()

  if (!row || !row.is_active) {
    return unauthorized(c, 'Email hoặc mật khẩu không đúng')
  }
  if (!row.password_hash || !row.password_salt) {
    return unauthorized(c, 'Tài khoản chưa đặt mật khẩu')
  }

  const ok = await verifyPassword(
    body.password,
    row.password_salt,
    row.password_hash,
  )
  if (!ok) return unauthorized(c, 'Email hoặc mật khẩu không đúng')

  const { token, expiresAt } = await createSession(c.env, {
    userId: row.id,
    organizationId: row.organization_id,
    ip: c.req.header('CF-Connecting-IP'),
    userAgent: c.req.header('User-Agent'),
  })

  await c.env.DB.prepare(
    `UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  )
    .bind(row.id)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: row.organization_id,
    actorUserId: row.id,
    actorRole: row.account_type,
    actorEmail: row.email,
    action: 'auth.login',
    entityType: 'user',
    entityId: row.id,
    detail: 'Password login',
    ip: c.req.header('CF-Connecting-IP'),
  })

  c.header(
    'Set-Cookie',
    buildSessionCookie(token, expiresAt, isSecureRequest(c)),
  )

  return json(c, {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    accountType: row.account_type,
    mustResetPassword: row.must_reset_password === 1,
  })
})

auth.post('/logout', async (c) => {
  const token = parseCookies(c.req.header('Cookie'))[SESSION_COOKIE]
  if (token) await destroySession(c.env, token)
  c.header('Set-Cookie', clearSessionCookie(isSecureRequest(c)))
  return json(c, { ok: true })
})

auth.post('/change-password', requireAuth, async (c) => {
  let body: z.infer<typeof changePasswordSchema>
  try {
    body = changePasswordSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid password payload')
  }

  const user = c.get('user')
  // Always change password for the session actor, not view-as target.
  const session = await c.env.DB.prepare(
    `SELECT user_id FROM sessions WHERE id = ? LIMIT 1`,
  )
    .bind(user.sessionId)
    .first<{ user_id: string }>()
  if (!session) return unauthorized(c, 'Session invalid')

  const row = await c.env.DB.prepare(
    `SELECT password_hash, password_salt, organization_id, email
     FROM users WHERE id = ? LIMIT 1`,
  )
    .bind(session.user_id)
    .first<{
      password_hash: string | null
      password_salt: string | null
      organization_id: string
      email: string
    }>()

  if (!row?.password_hash || !row.password_salt) {
    return badRequest(c, 'Password not set')
  }

  const ok = await verifyPassword(
    body.currentPassword,
    row.password_salt,
    row.password_hash,
  )
  if (!ok) return unauthorized(c, 'Mật khẩu hiện tại không đúng')

  const { hash, salt } = await hashPassword(body.newPassword)
  await c.env.DB.prepare(
    `UPDATE users
     SET password_hash = ?, password_salt = ?, must_reset_password = 0,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  )
    .bind(hash, salt, session.user_id)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: row.organization_id,
    actorUserId: session.user_id,
    actorEmail: row.email,
    action: 'auth.change_password',
    entityType: 'user',
    entityId: session.user_id,
    detail: 'User changed password',
  })

  return json(c, { ok: true })
})

auth.post('/view-as', requireAuth, requireActorSuperAdmin(), async (c) => {
  const body = z
    .object({ userId: z.string().min(1) })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return badRequest(c, 'userId required')

  const user = c.get('user')
  const target = await c.env.DB.prepare(
    `SELECT id, organization_id, is_active FROM users WHERE id = ? LIMIT 1`,
  )
    .bind(body.data.userId)
    .first<{ id: string; organization_id: string; is_active: number }>()

  if (!target || !target.is_active) {
    return apiError(c, 404, 'not_found', 'User not found')
  }
  if (target.organization_id !== user.organizationId) {
    return apiError(c, 403, 'forbidden', 'Cross-organization view-as denied')
  }

  await c.env.DB.prepare(
    `UPDATE sessions SET view_as_user_id = ? WHERE id = ?`,
  )
    .bind(target.id, user.sessionId)
    .run()

  return json(c, { ok: true, viewAsUserId: target.id })
})

auth.post('/clear-view-as', requireAuth, requireActorSuperAdmin(), async (c) => {
  const user = c.get('user')
  await c.env.DB.prepare(
    `UPDATE sessions SET view_as_user_id = NULL WHERE id = ?`,
  )
    .bind(user.sessionId)
    .run()
  return json(c, { ok: true })
})

auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user')
  const session = await c.env.DB.prepare(
    `SELECT user_id, view_as_user_id FROM sessions WHERE id = ? LIMIT 1`,
  )
    .bind(user.sessionId)
    .first<{ user_id: string; view_as_user_id: string | null }>()

  const actorId = session?.user_id ?? user.id
  const actor = await c.env.DB.prepare(
    `SELECT id, email, display_name, account_type, employee_id, must_reset_password
     FROM users WHERE id = ? LIMIT 1`,
  )
    .bind(actorId)
    .first<{
      id: string
      email: string
      display_name: string
      account_type: string
      employee_id: string | null
      must_reset_password: number
    }>()

  if (!actor) return unauthorized(c, 'User missing')

  const modules = await listAllowedModules(c.env.DB, user)
  const actorType = actor.account_type as 'super_admin' | 'admin' | 'user'
  // Effective identity (view-as target when active) drives UX permissions.
  const effectiveType = user.accountType
  const viewingAs = !!session?.view_as_user_id

  return json(c, {
    id: viewingAs ? user.effectiveUserId : actor.id,
    organizationId: user.organizationId,
    email: viewingAs ? user.email : actor.email,
    displayName: viewingAs ? user.displayName : actor.display_name,
    accountType: effectiveType,
    employeeId: user.employeeId,
    mustResetPassword: viewingAs
      ? user.mustResetPassword
      : actor.must_reset_password === 1,
    viewAsUserId: session?.view_as_user_id ?? null,
    effectiveUserId: user.effectiveUserId,
    /** Real session owner (for badge / clear view-as). */
    actorAccountType: actorType,
    actorDisplayName: actor.display_name,
    modules,
    /** Edit capability follows effective identity during view-as. */
    canEditData: effectiveType === 'super_admin' || effectiveType === 'admin',
    /** Only real Super Admin may manage data-source integrations. */
    canManageDataSources: actorType === 'super_admin' && !viewingAs,
  })
})

export default auth
