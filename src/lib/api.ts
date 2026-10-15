export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
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
      else if (body.error && typeof body.error === 'object' && body.error.message)
        detail = body.error.message
      else if (body.message) detail = body.message
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
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
  modules: string[]
  /** Admin + Super Admin: edit HR / account info. */
  canEditData: boolean
  /** Super Admin only: connect / toggle data sources. */
  canManageDataSources: boolean
}

export function fetchMe(): Promise<MeUser> {
  return fetchJson<MeUser>('/api/auth/me')
}

export function login(email: string, password: string) {
  return fetchJson<{
    id: string
    email: string
    displayName: string
    accountType: AccountType
    mustResetPassword: boolean
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout() {
  return fetchJson<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string) {
  return fetchJson<{ ok: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
