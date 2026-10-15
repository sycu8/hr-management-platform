/**
 * Worker Env for Hono bindings.
 *
 * Binding shapes come from `worker-configuration.d.ts` (regenerate with
 * `npm run cf-typegen` after wrangler.jsonc changes). This module adds
 * local/dev secrets and shared RBAC types used by middleware/routes.
 */
export type Env = Cloudflare.Env & {
  /** Local-only (.dev.vars) — maps to `users.email`; never trust client role. */
  DEV_AUTH_EMAIL?: string
  /** When `true`, allow DEV_AUTH without Access JWT (also allowed if ACCESS_* are placeholders). */
  ALLOW_DEV_AUTH?: string
}

/** App roles stored in `users.role` (authority comes from DB, never the client). */
export type AppRole = 'admin' | 'hr' | 'manager' | 'finance' | 'employee'

/** Permission levels in `permission_matrix.level`. */
export type PermissionLevel = 0 | 1 | 2

/** Module keys aligned with seed `permission_matrix` and `src/lib/nav.ts`. */
export type ModuleKey =
  | 'dash'
  | 'emp'
  | 'rec'
  | 'leave'
  | 'trip'
  | 'pay'
  | 'perf'
  | 'learn'
  | 'pol'
  | 'sys'
  | (string & {})
