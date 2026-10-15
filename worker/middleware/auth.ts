import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { AppRole, Env } from '../env.ts'
import { unauthorized } from '../lib/http.ts'

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

/** Cloudflare Access properties on ExecutionContext when an Access app matched. */
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
const DEV_AUTH_EMAIL_HEADER = 'DEV_AUTH_EMAIL'

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

/** Preferred path: Workers Access runtime (`ctx.access`). */
async function emailFromAccessContext(
  ctx: ExecutionContextWithAccess,
  env: Env,
): Promise<string | null> {
  if (!ctx.access) return null
  if (
    !isPlaceholderAccessConfig(env) &&
    !audMatches(env.ACCESS_AUD, ctx.access.aud)
  ) {
    throw new Error('Access AUD mismatch')
  }
  const identity = await ctx.access.getIdentity()
  return identity.email?.trim() || null
}

/** Fallback: verify `CF-Access-Jwt-Assertion` with team JWKS. */
async function emailFromAccessJwt(
  token: string,
  env: Env,
): Promise<string | null> {
  if (isPlaceholderAccessConfig(env)) {
    return null
  }

  const { jwks, normalized } = getAccessJwks(env.ACCESS_TEAM_DOMAIN)
  const { payload } = await jwtVerify(token, jwks, {
    issuer: `https://${normalized}`,
    audience: env.ACCESS_AUD,
  })

  const email =
    (typeof payload.email === 'string' && payload.email) ||
    (typeof payload.common_name === 'string' && payload.common_name) ||
    null

  return email?.trim() || null
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
 * Authenticate via Cloudflare Access (`ctx.access` → JWT), or local DEV_AUTH.
 * Role/organization always come from the `users` table — never from the client.
 */
export const requireAuth = createMiddleware<{
  Bindings: Env
  Variables: { user: AuthUser }
}>(async (c, next) => {
  let email: string | null = null

  try {
    email = await emailFromAccessContext(
      c.executionCtx as ExecutionContextWithAccess,
      c.env,
    )
  } catch {
    return unauthorized(c, 'Invalid Access identity')
  }

  if (!email) {
    const assertion = c.req.header(ACCESS_ASSERTION_HEADER)
    if (assertion) {
      try {
        email = await emailFromAccessJwt(assertion, c.env)
      } catch {
        return unauthorized(c, 'Invalid Access token')
      }
      if (!email) {
        return unauthorized(c, 'Access token missing email claim')
      }
    } else {
      email = resolveDevEmail(c)
      if (!email) {
        return unauthorized(c, 'Authentication required')
      }
    }
  }

  const user = await lookupUserByEmail(c.env.DB, email)
  if (!user) {
    return unauthorized(c, 'User not provisioned')
  }
  if (!user.isActive) {
    return unauthorized(c, 'User inactive')
  }

  c.set('user', user)
  await next()
})
