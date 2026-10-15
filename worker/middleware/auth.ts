import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { AppRole, Env } from '../env.ts'
import { unauthorized } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'

export type AuthUser = {
  id: string
  organizationId: string
  email: string
  displayName: string
  /** Authority role from `users` table — never from client input. */
  role: AppRole
  employeeId: string | null
  isActive: boolean
}

type UserRow = {
  id: string
  organization_id: string
  email: string
  display_name: string
  role: AppRole
  employee_id: string | null
  is_active: number
}

type AccessContext = {
  aud: string | string[]
  getIdentity: () => Promise<{
    email?: string
    name?: string
    idp?: { id?: string; type?: string }
  }>
}

type ExecutionContextWithAccess = ExecutionContext & {
  access?: AccessContext
}

const ACCESS_ASSERTION_HEADER = 'CF-Access-Jwt-Assertion'
const ACCESS_EMAIL_HEADER = 'CF-Access-Authenticated-User-Email'
const DEV_AUTH_EMAIL_HEADER = 'DEV_AUTH_EMAIL'
const DEFAULT_ORG_ID = 'org_demo'

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function normalizeTeamDomain(teamDomain: string): string {
  return teamDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function getAccessJwks(teamDomain: string) {
  const normalized = normalizeTeamDomain(teamDomain)
  let jwks = jwksByDomain.get(normalized)
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${normalized}/cdn-cgi/access/certs`),
    )
    jwksByDomain.set(normalized, jwks)
  }
  return { jwks, normalized }
}

function isPlaceholderAccessConfig(env: Env): boolean {
  return (
    !env.ACCESS_TEAM_DOMAIN ||
    !env.ACCESS_AUD ||
    env.ACCESS_TEAM_DOMAIN.includes('REPLACE_WITH') ||
    env.ACCESS_AUD.includes('REPLACE_WITH')
  )
}

function allowDevAuth(env: Env): boolean {
  return env.ALLOW_DEV_AUTH === 'true' || isPlaceholderAccessConfig(env)
}

function audMatches(expected: string, actual: string | string[]): boolean {
  if (Array.isArray(actual)) return actual.includes(expected)
  return actual === expected
}

async function lookupUserByEmail(
  db: D1Database,
  email: string,
): Promise<AuthUser | null> {
  const row = await db
    .prepare(
      `SELECT id, organization_id, email, display_name, role, employee_id, is_active
       FROM users
       WHERE lower(email) = lower(?)
       LIMIT 1`,
    )
    .bind(email)
    .first<UserRow>()

  if (!row) return null

  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    employeeId: row.employee_id,
    isActive: row.is_active === 1,
  }
}

/** First Access login: create an org user so API/data work without manual seed. */
async function ensureUser(
  db: D1Database,
  email: string,
  displayName?: string | null,
): Promise<AuthUser> {
  const existing = await lookupUserByEmail(db, email)
  if (existing) return existing

  const id = newId()
  const name =
    displayName?.trim() ||
    email.split('@')[0]?.replace(/[._]/g, ' ') ||
    email

  await db
    .prepare(
      `INSERT INTO users (
         id, organization_id, email, display_name, role, employee_id, is_active, last_login_at
       ) VALUES (?, ?, ?, ?, 'employee', NULL, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    )
    .bind(id, DEFAULT_ORG_ID, email.toLowerCase(), name)
    .run()

  const created = await lookupUserByEmail(db, email)
  if (!created) throw new Error('Failed to provision Access user')
  return created
}

async function touchLastLogin(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE users
       SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`,
    )
    .bind(userId)
    .run()
}

type ResolvedIdentity = { email: string; displayName?: string | null }

async function identityFromAccessContext(
  ctx: ExecutionContextWithAccess,
  env: Env,
): Promise<ResolvedIdentity | null> {
  if (!ctx.access) return null
  if (
    !isPlaceholderAccessConfig(env) &&
    !audMatches(env.ACCESS_AUD, ctx.access.aud)
  ) {
    throw new Error('Access AUD mismatch')
  }
  const identity = await ctx.access.getIdentity()
  const email = identity.email?.trim()
  if (!email) return null
  return { email, displayName: identity.name }
}

async function identityFromAccessJwt(
  token: string,
  env: Env,
): Promise<ResolvedIdentity | null> {
  if (isPlaceholderAccessConfig(env)) return null

  const { jwks, normalized } = getAccessJwks(env.ACCESS_TEAM_DOMAIN)
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${normalized}`,
    audience: env.ACCESS_AUD,
  })

  const email =
    (typeof payload.email === 'string' && payload.email) ||
    (typeof payload.common_name === 'string' && payload.common_name) ||
    null
  if (!email) return null

  const name =
    (typeof payload.name === 'string' && payload.name) ||
    (typeof payload.given_name === 'string' && payload.given_name) ||
    null

  return { email: email.trim(), displayName: name }
}

function resolveDevEmail(c: {
  req: { header: (name: string) => string | undefined }
  env: Env
}): string | null {
  if (!allowDevAuth(c.env)) return null
  const fromHeader = c.req.header(DEV_AUTH_EMAIL_HEADER)?.trim()
  if (fromHeader) return fromHeader
  return c.env.DEV_AUTH_EMAIL?.trim() || null
}

/**
 * Authenticate via Cloudflare Access (`ctx.access` → JWT → Access email header),
 * or local DEV_AUTH. Auto-provisions unknown Access emails into org_demo.
 * Role always comes from the `users` table after provision — never from the client.
 */
export const requireAuth = createMiddleware<{
  Bindings: Env
  Variables: { user: AuthUser }
}>(async (c, next) => {
  let identity: ResolvedIdentity | null = null

  try {
    identity = await identityFromAccessContext(
      c.executionCtx as ExecutionContextWithAccess,
      c.env,
    )
  } catch (err) {
    console.error('access_context_failed', err)
    return unauthorized(c, 'Invalid Access identity')
  }

  if (!identity) {
    const assertion = c.req.header(ACCESS_ASSERTION_HEADER)
    if (assertion) {
      try {
        identity = await identityFromAccessJwt(assertion, c.env)
      } catch (err) {
        console.error('access_jwt_failed', err)
        return unauthorized(c, 'Invalid Access token')
      }
    }
  }

  // Trusted only when Access already presented an assertion (or ctx.access above).
  if (!identity) {
    const accessEmail = c.req.header(ACCESS_EMAIL_HEADER)?.trim()
    const assertion = c.req.header(ACCESS_ASSERTION_HEADER)
    if (accessEmail && assertion) {
      identity = { email: accessEmail }
    }
  }

  if (!identity) {
    const devEmail = resolveDevEmail(c)
    if (!devEmail) {
      return unauthorized(c, 'Authentication required')
    }
    identity = { email: devEmail }
  }

  let user: AuthUser
  try {
    user = await ensureUser(c.env.DB, identity.email, identity.displayName)
  } catch (err) {
    console.error('ensure_user_failed', err)
    return unauthorized(c, 'User provisioning failed')
  }

  if (!user.isActive) {
    return unauthorized(c, 'User inactive')
  }

  c.executionCtx.waitUntil(touchLastLogin(c.env.DB, user.id))
  c.set('user', user)
  await next()
})
