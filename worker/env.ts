/**
 * Worker Env for Hono bindings.
 * Regenerate ambient types with: npm run cf-typegen
 */
export type Env = Cloudflare.Env & {
  SESSION_SECRET?: string
  /** Workers AI binding for policy document OCR (toMarkdown). */
  AI?: Ai
}

/** Login account types (authority). */
export type AccountType = 'super_admin' | 'admin' | 'user'

/** Legacy module role labels retained in DB for older rows. */
export type LegacyRole = 'admin' | 'hr' | 'manager' | 'finance' | 'employee'

export type PermissionLevel = 0 | 1 | 2

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

/** HR functional capabilities for account_type=user */
export type Capability =
  | 'dashboard'
  | 'employees'
  | 'recruiting'
  | 'leave'
  | 'travel'
  | 'payroll'
  | 'benefits'
  | 'performance'
  | 'learning'
  | 'policies'

export const CAPABILITY_TO_MODULE: Record<Capability, ModuleKey> = {
  dashboard: 'dash',
  employees: 'emp',
  recruiting: 'rec',
  leave: 'leave',
  travel: 'trip',
  payroll: 'pay',
  benefits: 'pol',
  performance: 'perf',
  learning: 'learn',
  policies: 'pol',
}
