import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type PayrollRunRow = {
  id: string
  year_month: string
  status: string
  policy_version_id: string
  closed_at: string | null
  created_at: string
  legal_review_status: string
}

const payroll = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

payroll.use('*', requireAuth)

/**
 * List payroll runs.
 *
 * Note: closing / recalculating a run must gate on
 * `payroll_policy_versions.legal_review_status = 'approved'`
 * (and env LEGAL_REVIEW_REQUIRED) before mutation — not enforced on list.
 */
payroll.get('/runs', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const limit = Math.min(Number(c.req.query('limit') ?? 24) || 24, 100)
  const offset = Math.max(Number(c.req.query('offset') ?? 0) || 0, 0)

  const { results } = await c.env.DB.prepare(
    `SELECT
       r.id,
       r.year_month,
       r.status,
       r.policy_version_id,
       r.closed_at,
       r.created_at,
       p.legal_review_status
     FROM payroll_runs r
     INNER JOIN payroll_policy_versions p ON p.id = r.policy_version_id
     WHERE r.organization_id = ?
     ORDER BY r.year_month DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(user.organizationId, limit, offset)
    .all<PayrollRunRow>()

  return json(c, {
    items: results ?? [],
    limit,
    offset,
    legalReviewRequired: c.env.LEGAL_REVIEW_REQUIRED === 'true',
    note:
      'Mutations that close or compute payroll must require legal_review_status=approved when LEGAL_REVIEW_REQUIRED is true.',
  })
})

export default payroll
