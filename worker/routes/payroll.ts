import { Hono } from 'hono'
import { z } from 'zod'
import {
  bhxhCeiling,
  bhtnCeiling,
  payParamsMatchCatalog,
  type PayParams,
  VN_PAY_POLICY_CATALOG,
  VN_PAY_POLICY_CITATIONS,
} from '../../shared/domain/payroll.ts'
import type { Env } from '../env.ts'
import { writeAuditEvent } from '../lib/audit.ts'
import { badRequest, forbidden, json, notFound } from '../lib/http.ts'
import { newId } from '../lib/ids.ts'
import { isElevated, selfOnlyEmployeeFilter } from '../lib/scope.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type PayrollRunRow = {
  id: string
  year_month: string
  status: string
  policy_version_id: string
  totals_json: string
  closed_at: string | null
  closed_by: string | null
  created_at: string
  legal_review_status: string
}

type PayslipRow = {
  id: string
  gross: number
  employee_insurance: number
  pit: number
  net: number
  employer_insurance: number
  snapshot_json: string
  year_month: string
  run_status: string
  payroll_run_id: string
  employee_id: string
  employee_code: string
  employee_name: string
  department: string
  title: string | null
  base_salary: number | null
}

/** Parsed payslip snapshot fields used by UI (VN payroll detail). */
export type PayslipSnapshot = {
  ym?: string
  code?: string
  name?: string
  department?: string
  title?: string
  base?: number
  paidDays?: number
  stdDays?: number
  salaryDays?: number
  allow?: number
  bonus?: number
  exempt?: number
  gross?: number
  be?: { bhxh?: number; bhyt?: number; bhtn?: number }
  bhEmp?: number
  er?: {
    bhxh?: number
    om?: number
    tnld?: number
    bhyt?: number
    bhtn?: number
  }
  bhEr?: number
  pit?: number
  net?: number
  taxable?: number
  ded?: number
  dependents?: number
  prob?: boolean
  bhBase?: number
  /** Cơ sở đóng BHTN (có thể cao hơn bhBase khi lương vượt trần BHXH/BHYT). */
  bhtnBase?: number
  trip?: number
  ents?: Array<{ type?: string; kind?: string; amount?: number; title?: string }>
}

const payroll = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

payroll.use('*', requireAuth)

function isHrAdmin(user: AuthUser): boolean {
  return user.accountType === 'admin' || user.accountType === 'super_admin'
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function enrichPayslip(row: PayslipRow) {
  const snap = parseJson<PayslipSnapshot>(row.snapshot_json, {})
  const be = snap.be ?? {}
  const er = snap.er ?? {}
  return {
    id: row.id,
    payroll_run_id: row.payroll_run_id,
    employee_id: row.employee_id,
    year_month: row.year_month,
    run_status: row.run_status,
    employee_code: row.employee_code,
    employee_name: row.employee_name,
    department: row.department,
    title: row.title ?? snap.title ?? null,
    base: snap.base ?? row.base_salary ?? null,
    paid_days: snap.paidDays ?? null,
    std_days: snap.stdDays ?? null,
    salary_days: snap.salaryDays ?? null,
    allow: snap.allow ?? null,
    bonus: snap.bonus ?? null,
    exempt: snap.exempt ?? null,
    gross: row.gross,
    employee_insurance: row.employee_insurance,
    bhxh_emp: be.bhxh ?? null,
    bhyt_emp: be.bhyt ?? null,
    bhtn_emp: be.bhtn ?? null,
    pit: row.pit,
    net: row.net,
    employer_insurance: row.employer_insurance,
    bhxh_er: er.bhxh != null ? (er.bhxh ?? 0) + (er.om ?? 0) + (er.tnld ?? 0) : null,
    bhyt_er: er.bhyt ?? null,
    bhtn_er: er.bhtn ?? null,
    bh_base: snap.bhBase ?? null,
    bhtn_base: snap.bhtnBase ?? snap.bhBase ?? null,
    taxable: snap.taxable ?? null,
    dependents: snap.dependents ?? null,
    probation: snap.prob ?? false,
    trip: snap.trip ?? 0,
    ents: snap.ents ?? [],
    snapshot: snap,
  }
}

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
       r.totals_json,
       r.closed_at,
       r.closed_by,
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

  const showOrgTotals = isElevated(user)
  const items = (results ?? []).map((r) => {
    const totals = parseJson<{
      headcount?: number
      gross?: number
      pit?: number
      net?: number
      cost?: number
      bhEmp?: number
      bhEr?: number
      note?: string
    }>(r.totals_json, {})
    return {
      id: r.id,
      year_month: r.year_month,
      status: r.status,
      policy_version_id: r.policy_version_id,
      closed_at: r.closed_at,
      closed_by: r.closed_by,
      created_at: r.created_at,
      legal_review_status: r.legal_review_status,
      // Org aggregates only for Admin / Super Admin (B7)
      headcount: showOrgTotals ? (totals.headcount ?? null) : null,
      gross: showOrgTotals ? (totals.gross ?? null) : null,
      pit: showOrgTotals ? (totals.pit ?? null) : null,
      net: showOrgTotals ? (totals.net ?? null) : null,
      cost: showOrgTotals ? (totals.cost ?? null) : null,
      bh_emp_total: showOrgTotals ? (totals.bhEmp ?? null) : null,
      bh_er_total: showOrgTotals ? (totals.bhEr ?? null) : null,
      note: showOrgTotals ? (totals.note ?? null) : null,
      totals: showOrgTotals ? totals : {},
    }
  })

  return json(c, {
    items,
    limit,
    offset,
    legalReviewRequired: c.env.LEGAL_REVIEW_REQUIRED === 'true',
    note:
      'Mutations that close or compute payroll must require legal_review_status=approved when LEGAL_REVIEW_REQUIRED is true.',
  })
})

payroll.get('/runs/:id', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const run = await c.env.DB.prepare(
    `SELECT
       r.id,
       r.year_month,
       r.status,
       r.policy_version_id,
       r.totals_json,
       r.closed_at,
       r.closed_by,
       r.created_at,
       p.legal_review_status,
       p.policy_json
     FROM payroll_runs r
     INNER JOIN payroll_policy_versions p ON p.id = r.policy_version_id
     WHERE r.organization_id = ? AND r.id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<
      PayrollRunRow & { policy_json: string }
    >()

  if (!run) return notFound(c, 'Payroll run not found')

  const scoped = selfOnlyEmployeeFilter(user)
  if (scoped.ok === false) return forbidden(c, scoped.reason)
  const employeeFilter = scoped.filter

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.gross, i.employee_insurance, i.pit, i.net, i.employer_insurance,
            i.snapshot_json, i.payroll_run_id, i.employee_id,
            r.year_month, r.status AS run_status,
            e.code AS employee_code, e.full_name AS employee_name, e.department,
            e.title, e.base_salary
     FROM payroll_items i
     JOIN payroll_runs r ON r.id = i.payroll_run_id
     JOIN employees e ON e.id = i.employee_id
     WHERE r.organization_id = ? AND i.payroll_run_id = ?
       AND (? IS NULL OR i.employee_id = ?)
     ORDER BY e.code`,
  )
    .bind(user.organizationId, id, employeeFilter, employeeFilter)
    .all<PayslipRow>()

  const totals = isElevated(user)
    ? parseJson<Record<string, unknown>>(run.totals_json, {})
    : {}
  return json(c, {
    run: {
      id: run.id,
      year_month: run.year_month,
      status: run.status,
      policy_version_id: run.policy_version_id,
      closed_at: run.closed_at,
      closed_by: run.closed_by,
      created_at: run.created_at,
      legal_review_status: run.legal_review_status,
      totals,
      policy: isElevated(user) ? parseJson(run.policy_json, {}) : {},
    },
    items: (results ?? []).map(enrichPayslip),
  })
})

payroll.get('/payslips', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const ym = c.req.query('ym')
  const limit = Math.min(Number(c.req.query('limit') ?? 100) || 100, 300)

  const scoped = selfOnlyEmployeeFilter(user)
  if (scoped.ok === false) return forbidden(c, scoped.reason)
  const employeeFilter = scoped.filter

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.gross, i.employee_insurance, i.pit, i.net, i.employer_insurance,
            i.snapshot_json, i.payroll_run_id, i.employee_id,
            r.year_month, r.status AS run_status,
            e.code AS employee_code, e.full_name AS employee_name, e.department,
            e.title, e.base_salary
     FROM payroll_items i
     JOIN payroll_runs r ON r.id = i.payroll_run_id
     JOIN employees e ON e.id = i.employee_id
     WHERE r.organization_id = ?
       AND (? IS NULL OR r.year_month = ?)
       AND (? IS NULL OR i.employee_id = ?)
     ORDER BY r.year_month DESC, e.code
     LIMIT ?`,
  )
    .bind(
      user.organizationId,
      ym ?? null,
      ym ?? null,
      employeeFilter,
      employeeFilter,
      limit,
    )
    .all<PayslipRow>()

  return json(c, {
    items: (results ?? []).map(enrichPayslip),
    ym: ym ?? null,
  })
})

payroll.get('/payslips/:id', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const row = await c.env.DB.prepare(
    `SELECT i.id, i.gross, i.employee_insurance, i.pit, i.net, i.employer_insurance,
            i.snapshot_json, i.payroll_run_id, i.employee_id,
            r.year_month, r.status AS run_status,
            e.code AS employee_code, e.full_name AS employee_name, e.department,
            e.title, e.base_salary
     FROM payroll_items i
     JOIN payroll_runs r ON r.id = i.payroll_run_id
     JOIN employees e ON e.id = i.employee_id
     WHERE r.organization_id = ? AND i.id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<PayslipRow>()

  if (!row) return notFound(c, 'Payslip not found')

  const scoped = selfOnlyEmployeeFilter(user)
  if (scoped.ok === false) return forbidden(c, scoped.reason)
  if (scoped.filter && row.employee_id !== scoped.filter) {
    return forbidden(c, 'Chỉ xem phiếu lương của chính mình')
  }

  return json(c, { payslip: enrichPayslip(row) })
})

/** BH contribution summary per employee for a pay month (from payroll_items snapshots). */
payroll.get('/insurance', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const ym = c.req.query('ym') ?? '2026-09'
  const limit = Math.min(Number(c.req.query('limit') ?? 200) || 200, 300)

  const scoped = selfOnlyEmployeeFilter(user)
  if (scoped.ok === false) return forbidden(c, scoped.reason)
  const employeeFilter = scoped.filter

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.gross, i.employee_insurance, i.pit, i.net, i.employer_insurance,
            i.snapshot_json, i.payroll_run_id, i.employee_id,
            r.year_month, r.status AS run_status,
            e.code AS employee_code, e.full_name AS employee_name, e.department,
            e.title, e.base_salary
     FROM payroll_items i
     JOIN payroll_runs r ON r.id = i.payroll_run_id
     JOIN employees e ON e.id = i.employee_id
     WHERE r.organization_id = ?
       AND r.year_month = ?
       AND (? IS NULL OR i.employee_id = ?)
     ORDER BY e.code
     LIMIT ?`,
  )
    .bind(user.organizationId, ym, employeeFilter, employeeFilter, limit)
    .all<PayslipRow>()

  const items = (results ?? []).map((row) => {
    const p = enrichPayslip(row)
    return {
      id: p.id,
      employee_code: p.employee_code,
      employee_name: p.employee_name,
      department: p.department,
      probation: p.probation,
      bh_base: p.bh_base,
      bhtn_base: p.bhtn_base,
      bhxh_emp: p.bhxh_emp,
      bhyt_emp: p.bhyt_emp,
      bhtn_emp: p.bhtn_emp,
      bh_emp: p.employee_insurance,
      bhxh_er: p.bhxh_er,
      bhyt_er: p.bhyt_er,
      bhtn_er: p.bhtn_er,
      bh_er: p.employer_insurance,
      year_month: p.year_month,
      run_status: p.run_status,
    }
  })

  const participating = items.filter((x) => !x.probation && (x.bh_emp ?? 0) > 0)
  const sum = (fn: (x: (typeof items)[0]) => number) =>
    items.reduce((s, x) => s + fn(x), 0)

  return json(c, {
    ym,
    items,
    summary: {
      employee_total: sum((x) => x.bh_emp ?? 0),
      employer_total: sum((x) => x.bh_er ?? 0),
      grand_total: sum((x) => (x.bh_emp ?? 0) + (x.bh_er ?? 0)),
      headcount: items.length,
      participating: participating.length,
    },
  })
})

const earningSchema = z.object({
  employee_id: z.string().nullable().optional(),
  year_month: z.string().min(1).max(7),
  kind: z.enum(['allowance', 'bonus']),
  title: z.string().min(1).max(200),
  amount: z.number().int().positive(),
  taxable: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
})

payroll.post('/earnings', requireModule('pay', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được thêm phụ cấp & thưởng')
  }

  let body: z.infer<typeof earningSchema>
  try {
    body = earningSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid earning payload')
  }

  const empId =
    body.employee_id === 'all' || body.employee_id === ''
      ? null
      : (body.employee_id ?? null)

  if (empId) {
    const emp = await c.env.DB.prepare(
      `SELECT id FROM employees WHERE organization_id = ? AND id = ?`,
    )
      .bind(user.organizationId, empId)
      .first()
    if (!emp) return badRequest(c, 'employee_id không hợp lệ')
  }

  const id = newId()
  await c.env.DB.prepare(
    `INSERT INTO earnings (
       id, organization_id, employee_id, year_month, kind, title, amount, taxable, note
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.organizationId,
      empId,
      body.year_month,
      body.kind,
      body.title,
      body.amount,
      body.taxable === false ? 0 : 1,
      body.note ?? null,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.effectiveUserId,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'earnings.create',
    entityType: 'earning',
    entityId: id,
    detail: `Thêm ${body.kind === 'bonus' ? 'thưởng' : 'phụ cấp'} ${body.title}`,
  })

  return json(c, { id }, 201)
})

payroll.patch('/earnings/:id', requireModule('pay', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được sửa phụ cấp & thưởng')
  }

  const id = c.req.param('id')
  let body: z.infer<typeof earningSchema>
  try {
    body = earningSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid earning update')
  }

  const existing = await c.env.DB.prepare(
    `SELECT id FROM earnings WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first()
  if (!existing) return notFound(c, 'Earning not found')

  const empId =
    body.employee_id === 'all' || body.employee_id === ''
      ? null
      : (body.employee_id ?? null)

  await c.env.DB.prepare(
    `UPDATE earnings SET
       employee_id = ?, year_month = ?, kind = ?, title = ?, amount = ?,
       taxable = ?, note = ?
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(
      empId,
      body.year_month,
      body.kind,
      body.title,
      body.amount,
      body.taxable === false ? 0 : 1,
      body.note ?? null,
      id,
      user.organizationId,
    )
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.effectiveUserId,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'earnings.update',
    entityType: 'earning',
    entityId: id,
    detail: `Cập nhật ${body.title}`,
  })

  return json(c, { id })
})

payroll.delete('/earnings/:id', requireModule('pay', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được xóa phụ cấp & thưởng')
  }

  const id = c.req.param('id')
  const existing = await c.env.DB.prepare(
    `SELECT id, title FROM earnings WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first<{ id: string; title: string }>()
  if (!existing) return notFound(c, 'Earning not found')

  await c.env.DB.prepare(
    `DELETE FROM earnings WHERE id = ? AND organization_id = ?`,
  )
    .bind(id, user.organizationId)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.effectiveUserId,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'earnings.delete',
    entityType: 'earning',
    entityId: id,
    detail: `Xóa ${existing.title}`,
  })

  return json(c, { ok: true })
})


const payParamsSchema = z.object({
  ref: z.number().positive(),
  capMult: z.number().positive(),
  bhtnRegionMin: z.number().positive().optional(),
  bhtnCapMult: z.number().positive().optional(),
  bhEmp: z.object({
    bhxh: z.number().min(0).max(1),
    bhyt: z.number().min(0).max(1),
    bhtn: z.number().min(0).max(1),
  }),
  bhEr: z.object({
    bhxh: z.number().min(0).max(1),
    om: z.number().min(0).max(1),
    tnld: z.number().min(0).max(1),
    bhyt: z.number().min(0).max(1),
    bhtn: z.number().min(0).max(1),
  }),
  selfDed: z.number().nonnegative(),
  depDed: z.number().nonnegative(),
  mealExempt: z.number().nonnegative(),
  brackets: z
    .array(z.tuple([z.number().positive(), z.number().min(0).max(1)]))
    .min(1),
})

type PolicyVersionRow = {
  id: string
  version: number
  effective_from: string
  effective_to: string | null
  policy_json: string
  source_citations_json: string
  legal_review_status: string
  legal_reviewed_by: string | null
  legal_reviewed_at: string | null
  created_at: string
}

function enrichPolicyVersion(row: PolicyVersionRow) {
  const policy = parseJson<PayParams>(row.policy_json, VN_PAY_POLICY_CATALOG.params)
  const citations = parseJson<unknown[]>(row.source_citations_json, [])
  return {
    id: row.id,
    version: row.version,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    policy,
    citations,
    legal_review_status: row.legal_review_status,
    legal_reviewed_by: row.legal_reviewed_by,
    legal_reviewed_at: row.legal_reviewed_at,
    created_at: row.created_at,
    bhxh_ceiling: bhxhCeiling(policy),
    bhtn_ceiling: bhtnCeiling(policy),
    matches_catalog: payParamsMatchCatalog(policy),
    is_current: row.effective_to == null,
  }
}

/** Shipped statutory catalog (code + Pháp lý seed) — not a live scrape. */
payroll.get('/policy-catalog', requireModule('pay', 1), async (c) => {
  const params = VN_PAY_POLICY_CATALOG.params
  return json(c, {
    catalog: {
      id: VN_PAY_POLICY_CATALOG.id,
      label: VN_PAY_POLICY_CATALOG.label,
      effectiveFrom: VN_PAY_POLICY_CATALOG.effectiveFrom,
      params,
      citations: VN_PAY_POLICY_CITATIONS,
      legalLibraryNote: VN_PAY_POLICY_CATALOG.legalLibraryNote,
      bhxh_ceiling: bhxhCeiling(params),
      bhtn_ceiling: bhtnCeiling(params),
    },
  })
})

payroll.get('/policy-versions', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT id, version, effective_from, effective_to, policy_json,
            source_citations_json, legal_review_status,
            legal_reviewed_by, legal_reviewed_at, created_at
     FROM payroll_policy_versions
     WHERE organization_id = ?
     ORDER BY version DESC`,
  )
    .bind(user.organizationId)
    .all<PolicyVersionRow>()

  const items = (results ?? []).map(enrichPolicyVersion)
  const current = items.find((x) => x.is_current) ?? items[0] ?? null
  return json(c, {
    items,
    current,
    catalogId: VN_PAY_POLICY_CATALOG.id,
    driftFromCatalog: current ? !current.matches_catalog : false,
  })
})

payroll.get('/policy-versions/:id', requireModule('pay', 1), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    `SELECT id, version, effective_from, effective_to, policy_json,
            source_citations_json, legal_review_status,
            legal_reviewed_by, legal_reviewed_at, created_at
     FROM payroll_policy_versions
     WHERE organization_id = ? AND id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<PolicyVersionRow>()
  if (!row) return notFound(c, 'Policy version not found')
  return json(c, { item: enrichPolicyVersion(row) })
})

/**
 * Update editable params on the current (open) policy version.
 * Resets legal_review_status → pending so a reviewer must re-approve before close.
 */
payroll.patch('/policy-versions/:id', requireModule('pay', 2), async (c) => {
  const user = c.get('user')
  if (!isHrAdmin(user)) {
    return forbidden(c, 'Chỉ Admin / Super Admin được sửa tham số tính lương')
  }

  const id = c.req.param('id')
  let body: z.infer<typeof payParamsSchema>
  try {
    body = payParamsSchema.parse(await c.req.json())
  } catch {
    return badRequest(c, 'Invalid pay params payload')
  }

  const row = await c.env.DB.prepare(
    `SELECT id, version, effective_from, effective_to, policy_json,
            source_citations_json, legal_review_status,
            legal_reviewed_by, legal_reviewed_at, created_at
     FROM payroll_policy_versions
     WHERE organization_id = ? AND id = ?
     LIMIT 1`,
  )
    .bind(user.organizationId, id)
    .first<PolicyVersionRow>()
  if (!row) return notFound(c, 'Policy version not found')
  if (row.effective_to != null) {
    return badRequest(
      c,
      'Chỉ sửa được phiên bản đang hiệu lực (effective_to trống). Tạo phiên bản mới nếu cần lịch sử.',
    )
  }

  const policy: PayParams = {
    ...body,
    brackets: body.brackets.map(([cap, rate]) => [cap, rate] as const),
  }

  await c.env.DB.prepare(
    `UPDATE payroll_policy_versions SET
       policy_json = ?,
       legal_review_status = 'pending',
       legal_reviewed_by = NULL,
       legal_reviewed_at = NULL
     WHERE id = ? AND organization_id = ?`,
  )
    .bind(JSON.stringify(policy), id, user.organizationId)
    .run()

  await writeAuditEvent(c.env.DB, {
    organizationId: user.organizationId,
    actorUserId: user.effectiveUserId,
    actorRole: user.accountType,
    actorEmail: user.email,
    action: 'payroll_policy.update',
    entityType: 'payroll_policy_version',
    entityId: id,
    detail: `Sửa tham số tính lương ${id} (chờ duyệt lại)`,
  })

  const updated = await c.env.DB.prepare(
    `SELECT id, version, effective_from, effective_to, policy_json,
            source_citations_json, legal_review_status,
            legal_reviewed_by, legal_reviewed_at, created_at
     FROM payroll_policy_versions
     WHERE organization_id = ? AND id = ?`,
  )
    .bind(user.organizationId, id)
    .first<PolicyVersionRow>()

  return json(c, { item: enrichPolicyVersion(updated!) })
})

/**
 * Apply shipped catalog `VN_PAY_POLICY_2026_07` (+ Pháp lý citations) onto the
 * current open policy version. Practical “auto update when law changes”:
 * numbers ship in platform code / legal library seed; this action copies them
 * into the org’s active `payroll_policy_versions` row.
 */
payroll.post(
  '/policy-versions/:id/sync-catalog',
  requireModule('pay', 2),
  async (c) => {
    const user = c.get('user')
    if (!isHrAdmin(user)) {
      return forbidden(c, 'Chỉ Admin / Super Admin được đồng bộ tham số pháp lý')
    }

    const id = c.req.param('id')
    const row = await c.env.DB.prepare(
      `SELECT id, version, effective_from, effective_to, policy_json,
              source_citations_json, legal_review_status,
              legal_reviewed_by, legal_reviewed_at, created_at
       FROM payroll_policy_versions
       WHERE organization_id = ? AND id = ?
       LIMIT 1`,
    )
      .bind(user.organizationId, id)
      .first<PolicyVersionRow>()
    if (!row) return notFound(c, 'Policy version not found')
    if (row.effective_to != null) {
      return badRequest(
        c,
        'Chỉ đồng bộ được phiên bản đang hiệu lực (effective_to trống).',
      )
    }

    const policy = VN_PAY_POLICY_CATALOG.params
    const citations = [...VN_PAY_POLICY_CITATIONS]

    await c.env.DB.prepare(
      `UPDATE payroll_policy_versions SET
         policy_json = ?,
         source_citations_json = ?,
         legal_review_status = 'pending',
         legal_reviewed_by = NULL,
         legal_reviewed_at = NULL
       WHERE id = ? AND organization_id = ?`,
    )
      .bind(
        JSON.stringify(policy),
        JSON.stringify(citations),
        id,
        user.organizationId,
      )
      .run()

    await writeAuditEvent(c.env.DB, {
      organizationId: user.organizationId,
      actorUserId: user.effectiveUserId,
      actorRole: user.accountType,
      actorEmail: user.email,
      action: 'payroll_policy.sync_catalog',
      entityType: 'payroll_policy_version',
      entityId: id,
      detail: `Đồng bộ ${VN_PAY_POLICY_CATALOG.id} → ${id}`,
    })

    const updated = await c.env.DB.prepare(
      `SELECT id, version, effective_from, effective_to, policy_json,
              source_citations_json, legal_review_status,
              legal_reviewed_by, legal_reviewed_at, created_at
       FROM payroll_policy_versions
       WHERE organization_id = ? AND id = ?`,
    )
      .bind(user.organizationId, id)
      .first<PolicyVersionRow>()

    return json(c, {
      item: enrichPolicyVersion(updated!),
      catalogId: VN_PAY_POLICY_CATALOG.id,
      note: VN_PAY_POLICY_CATALOG.legalLibraryNote,
    })
  },
)

export default payroll
