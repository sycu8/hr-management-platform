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
      else if (body.error?.message) detail = body.error.message
      else if (body.message) detail = body.message
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Authenticated user payload from `GET /api/me`. */
export type MeUser = {
  id: string
  organizationId: string
  email: string
  displayName: string
  role: string
  employeeId: string | null
}

export function fetchMe(): Promise<MeUser> {
  return fetchJson<MeUser>('/api/me')
}
