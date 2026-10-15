import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function json<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json(data, status)
}

export function apiError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  }
  return c.json(body, status)
}

export function unauthorized(c: Context, message = 'Unauthorized') {
  return apiError(c, 401, 'unauthorized', message)
}

export function forbidden(c: Context, message = 'Forbidden') {
  return apiError(c, 403, 'forbidden', message)
}

export function notFound(c: Context, message = 'Not found') {
  return apiError(c, 404, 'not_found', message)
}

export function badRequest(c: Context, message: string, details?: unknown) {
  return apiError(c, 400, 'bad_request', message, details)
}

export function serverError(c: Context, message = 'Internal server error') {
  return apiError(c, 500, 'internal_error', message)
}
