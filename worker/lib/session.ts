import type { Env } from '../env.ts'
import { newId } from './ids.ts'
import { hashToken } from './password.ts'

export const SESSION_COOKIE = 'hrm_session'
const SESSION_DAYS = 7

export type SessionRow = {
  id: string
  user_id: string
  organization_id: string
  token_hash: string
  view_as_user_id: string | null
  expires_at: string
}

export function sessionExpiryIso(days = SESSION_DAYS): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

export function buildSessionCookie(
  token: string,
  expiresAt: string,
  secure: boolean,
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export async function createSession(
  env: Env,
  input: {
    userId: string
    organizationId: string
    ip?: string | null
    userAgent?: string | null
  },
): Promise<{ token: string; expiresAt: string }> {
  const token = newId() + newId()
  const tokenHash = await hashToken(token)
  const id = newId()
  const expiresAt = sessionExpiryIso()

  await env.DB.prepare(
    `INSERT INTO sessions (
       id, user_id, organization_id, token_hash, view_as_user_id,
       expires_at, ip, user_agent
     ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`,
  )
    .bind(
      id,
      input.userId,
      input.organizationId,
      tokenHash,
      expiresAt,
      input.ip ?? null,
      input.userAgent ?? null,
    )
    .run()

  return { token, expiresAt }
}

export async function findSessionByToken(
  env: Env,
  token: string,
): Promise<SessionRow | null> {
  const tokenHash = await hashToken(token)
  const row = await env.DB.prepare(
    `SELECT id, user_id, organization_id, token_hash, view_as_user_id, expires_at
     FROM sessions
     WHERE token_hash = ?
     LIMIT 1`,
  )
    .bind(tokenHash)
    .first<SessionRow>()

  if (!row) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(row.id).run()
    return null
  }
  return row
}

export async function destroySession(env: Env, token: string): Promise<void> {
  const tokenHash = await hashToken(token)
  await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .run()
}
