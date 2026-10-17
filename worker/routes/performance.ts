import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json, privateCacheHeaders } from '../lib/http.ts'
import {
  avgProgress,
  parseKeyResults,
  parsePeriod,
} from '../lib/okr.ts'
import {
  chartCycleLabel,
  computeTrend,
  pickScore,
  shortCycleLabel,
} from '../lib/perf-history.ts'
import {
  resolveEmployeeScope,
  scopeSqlClause,
} from '../lib/scope.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

const TTL = 30

type CycleRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
}

type RatingRow = {
  cycle_id: string
  employee_id: string
  self_score: number | null
  manager_score: number | null
  final_score: number | null
  employee_name: string
  employee_code: string
  department: string | null
}

type ObjRow = {
  id: string
  employee_id: string
  period: string
  objective: string
  key_results_json: string
}

const performance = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

performance.use('*', requireAuth)

/**
 * Aggregated performance history: per-employee scores by cycle, trend,
 * and objectives progress for the detail widgets.
 */
performance.get('/history', requireModule('perf', 1), async (c) => {
  const user = c.get('user')
  const scope = await resolveEmployeeScope(c.env.DB, user)
  const sc = scopeSqlClause(scope, 'e.id')
  if (sc.empty) {
    return json(
      c,
      { cycles: [], employees: [] },
      200,
      privateCacheHeaders(TTL),
    )
  }

  const { results: cycleRows } = await c.env.DB.prepare(
    `SELECT id, name, start_date, end_date, status
     FROM review_cycles
     WHERE organization_id = ?
     ORDER BY start_date ASC`,
  )
    .bind(user.organizationId)
    .all<CycleRow>()

  const allCycles = cycleRows ?? []
  // Prefer cycles that already have ratings; fall back to non-planned.
  const { results: ratedCycleIds } = await c.env.DB.prepare(
    `SELECT DISTINCT cycle_id AS id FROM ratings WHERE organization_id = ?`,
  )
    .bind(user.organizationId)
    .all<{ id: string }>()
  const ratedSet = new Set((ratedCycleIds ?? []).map((r) => r.id))
  const cycles =
    ratedSet.size > 0
      ? allCycles.filter((cy) => ratedSet.has(cy.id))
      : allCycles.filter((cy) => cy.status !== 'planned')

  const { results: ratingRows } = await c.env.DB.prepare(
    `SELECT r.cycle_id, r.employee_id, r.self_score, r.manager_score, r.final_score,
            e.full_name AS employee_name, e.code AS employee_code,
            e.department AS department
     FROM ratings r
     JOIN employees e ON e.id = r.employee_id
     WHERE r.organization_id = ?
       AND e.status = 'active'
       ${sc.sql}
     ORDER BY e.code`,
  )
    .bind(user.organizationId, ...sc.binds)
    .all<RatingRow>()

  const { results: objRows } = await c.env.DB.prepare(
    `SELECT o.id, o.employee_id, o.period, o.objective, o.key_results_json
     FROM objectives o
     JOIN employees e ON e.id = o.employee_id
     WHERE o.organization_id = ?
       AND e.status = 'active'
       ${sc.sql}`,
  )
    .bind(user.organizationId, ...sc.binds)
    .all<ObjRow>()

  type EmpAgg = {
    employee_id: string
    employee_code: string
    employee_name: string
    department: string
    scoreByCycle: Map<string, number | null>
  }

  const byEmp = new Map<string, EmpAgg>()
  for (const row of ratingRows ?? []) {
    let emp = byEmp.get(row.employee_id)
    if (!emp) {
      emp = {
        employee_id: row.employee_id,
        employee_code: row.employee_code,
        employee_name: row.employee_name,
        department: row.department ?? '—',
        scoreByCycle: new Map(),
      }
      byEmp.set(row.employee_id, emp)
    }
    emp.scoreByCycle.set(
      row.cycle_id,
      pickScore(row.final_score, row.manager_score, row.self_score),
    )
  }

  // Include active employees in scope with objectives but no ratings yet.
  const { results: activeEmps } = await c.env.DB.prepare(
    `SELECT e.id AS employee_id, e.code AS employee_code, e.full_name AS employee_name,
            e.department AS department
     FROM employees e
     WHERE e.organization_id = ?
       AND e.status = 'active'
       ${sc.sql}
     ORDER BY e.code`,
  )
    .bind(user.organizationId, ...sc.binds)
    .all<{
      employee_id: string
      employee_code: string
      employee_name: string
      department: string | null
    }>()

  for (const row of activeEmps ?? []) {
    if (byEmp.has(row.employee_id)) continue
    const hasObj = (objRows ?? []).some((o) => o.employee_id === row.employee_id)
    if (!hasObj) continue
    byEmp.set(row.employee_id, {
      employee_id: row.employee_id,
      employee_code: row.employee_code,
      employee_name: row.employee_name,
      department: row.department ?? '—',
      scoreByCycle: new Map(),
    })
  }

  const objsByEmp = new Map<
    string,
    Array<{
      id: string
      period: string
      objective: string
      progress_pct: number
      sortKey: number
    }>
  >()

  for (const o of objRows ?? []) {
    const krs = parseKeyResults(o.key_results_json)
    const progress_pct = Math.round(avgProgress(krs) * 100)
    const parsed = parsePeriod(o.period)
    const sortKey = parsed
      ? parsed.year * 10 + Math.max(...parsed.quarters)
      : 0
    const list = objsByEmp.get(o.employee_id) ?? []
    list.push({
      id: o.id,
      period: o.period,
      objective: o.objective,
      progress_pct,
      sortKey,
    })
    objsByEmp.set(o.employee_id, list)
  }

  const cyclePayload = cycles.map((cy) => ({
    id: cy.id,
    name: cy.name,
    short_label: shortCycleLabel(cy.name),
    chart_label: chartCycleLabel(cy.name),
    start_date: cy.start_date,
    end_date: cy.end_date,
    status: cy.status,
  }))

  const employees = [...byEmp.values()]
    .map((emp) => {
      const scores = cycles.map((cy) => ({
        cycle_id: cy.id,
        score: emp.scoreByCycle.get(cy.id) ?? null,
      }))
      const trend = computeTrend(scores.map((s) => s.score))
      const objectives = (objsByEmp.get(emp.employee_id) ?? [])
        .sort((a, b) => b.sortKey - a.sortKey)
        .slice(0, 6)
        .map(({ id, period, objective, progress_pct }) => ({
          id,
          period,
          objective,
          progress_pct,
        }))
      return {
        employee_id: emp.employee_id,
        employee_code: emp.employee_code,
        employee_name: emp.employee_name,
        department: emp.department,
        scores,
        trend,
        objectives,
      }
    })
    .sort((a, b) => a.employee_code.localeCompare(b.employee_code, 'vi'))

  return json(
    c,
    { cycles: cyclePayload, employees },
    200,
    privateCacheHeaders(TTL),
  )
})

export default performance
