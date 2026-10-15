export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type CacheEntry = { exp: number; data: unknown }

/** In-memory GET cache (per tab) — cuts repeat loads when navigating. */
const GET_TTL_MS = 25_000
const memoryCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

function cacheKey(url: string, init?: RequestInit): string | null {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET') return null
  if (init?.cache === 'no-store' || init?.cache === 'reload') return null
  return url
}

export function clearApiCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix) || key.includes(prefix)) memoryCache.delete(key)
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const key = cacheKey(url, init)

  if (key) {
    const hit = memoryCache.get(key)
    if (hit && hit.exp > Date.now()) return hit.data as T

    const pending = inflight.get(key)
    if (pending) return pending as Promise<T>
  }

  const run = (async () => {
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    })

    if (!res.ok) {
      let detail = res.statusText || 'Request failed'
      try {
        const body = (await res.json()) as {
          error?: { message?: string } | string
          message?: string
        }
        if (typeof body.error === 'string') detail = body.error
        else if (
          body.error &&
          typeof body.error === 'object' &&
          body.error.message
        )
          detail = body.error.message
        else if (body.message) detail = body.message
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail)
    }

    if (res.status === 204) return undefined as T
    const data = (await res.json()) as T

    if (key) {
      memoryCache.set(key, { exp: Date.now() + GET_TTL_MS, data })
    } else {
      // Mutations invalidate related cached reads
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        clearApiCache('/api/')
      }
    }

    return data
  })()

  if (key) {
    inflight.set(key, run)
    try {
      return (await run) as T
    } finally {
      inflight.delete(key)
    }
  }

  return run
}

export type AccountType = 'super_admin' | 'admin' | 'user'

export type MeUser = {
  id: string
  organizationId: string
  email: string
  displayName: string
  accountType: AccountType
  employeeId: string | null
  mustResetPassword: boolean
  viewAsUserId: string | null
  effectiveUserId: string
  actorAccountType?: AccountType
  actorDisplayName?: string
  modules: string[]
  /** Admin + Super Admin: edit HR / account info (effective identity). */
  canEditData: boolean
  /** Super Admin only: connect / toggle data sources (real actor). */
  canManageDataSources: boolean
}

export function fetchMe(): Promise<MeUser> {
  return fetchJson<MeUser>('/api/auth/me')
}

export function login(
  email: string,
  password: string,
  turnstileToken: string,
) {
  clearApiCache()
  return fetchJson<{
    id: string
    email: string
    displayName: string
    accountType: AccountType
    mustResetPassword: boolean
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, turnstileToken }),
  })
}

export function logout() {
  clearApiCache()
  return fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string) {
  return fetchJson<{ ok: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
