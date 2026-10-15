import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json } from '../lib/http.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type CountRow = { label: string; count: number }
type MonthRow = { ym: string; n: number }
type DaysRow = { ym: string; days: number }

const dashboard = new Hono<{
  Bindings: Env
  Variables: { user: AuthUser }
}>()

dashboard.use('*', requireAuth)

function monthsBack(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`,
    )
  }
  return out
}

function fillSeries(
  keys: string[],
  rows: { ym: string; value: number }[],
): { month: string; value: number }[] {
  const map = new Map(rows.map((r) => [r.ym, r.value]))
  return keys.map((month) => ({ month, value: map.get(month) ?? 0 }))
}

dashboard.get('/summary', requireModule('dash', 1), async (c) => {
  const user = c.get('user')
  const org = user.organizationId
  const today = new Date().toISOString().slice(0, 10)
  const horizon = new Date()
  horizon.setMonth(horizon.getMonth() + 3)
  const horizonIso = horizon.toISOString().slice(0, 10)
  const monthKeys = monthsBack(6)

  const active = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM employees
     WHERE organization_id = ? AND status = 'active'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const left = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM employees
     WHERE organization_id = ? AND status = 'left'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const pendingLeave = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM leave_requests
     WHERE organization_id = ? AND status = 'pending'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const pendingTrips = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM trips
     WHERE organization_id = ? AND status IN ('pm','ph','st','ap')`,
  )
    .bind(org)
    .first<{ n: number }>()

  const openJobs = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM job_requisitions
     WHERE organization_id = ? AND status = 'open'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const candidatesActive = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM candidates
     WHERE organization_id = ?
       AND stage NOT IN ('hired','rejected','Nhận việc','Loại')`,
  )
    .bind(org)
    .first<{ n: number }>()

  const onboardingDue = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM onboarding_plans
     WHERE organization_id = ?
       AND status != 'converted'
       AND (
         status = 'due_convert'
         OR (probation_end IS NOT NULL AND probation_end <= ?)
       )`,
  )
    .bind(org, today)
    .first<{ n: number }>()

  const contractsEnding = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM employees
     WHERE organization_id = ? AND status = 'active'
       AND contract_end IS NOT NULL
       AND contract_end >= ? AND contract_end <= ?`,
  )
    .bind(org, today, horizonIso)
    .first<{ n: number }>()

  const presence = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT employee_id) AS n FROM attendance_punches
     WHERE organization_id = ? AND work_date = ?`,
  )
    .bind(org, today)
    .first<{ n: number }>()

  const { results: byDept } = await c.env.DB.prepare(
    `SELECT department AS label, COUNT(*) AS count
     FROM employees
     WHERE organization_id = ? AND status = 'active'
     GROUP BY department
     ORDER BY count DESC, department`,
  )
    .bind(org)
    .all<CountRow>()

  const { results: hireRows } = await c.env.DB.prepare(
    `SELECT substr(joined_on, 1, 7) AS ym, COUNT(*) AS n
     FROM employees
     WHERE organization_id = ? AND joined_on IS NOT NULL
       AND joined_on >= date('now', '-6 months', 'start of month')
     GROUP BY ym`,
  )
    .bind(org)
    .all<MonthRow>()

  const { results: leaveRows } = await c.env.DB.prepare(
    `SELECT substr(left_on, 1, 7) AS ym, COUNT(*) AS n
     FROM employees
     WHERE organization_id = ? AND left_on IS NOT NULL
       AND left_on >= date('now', '-6 months', 'start of month')
     GROUP BY ym`,
  )
    .bind(org)
    .all<MonthRow>()

  const { results: leaveTypeRows } = await c.env.DB.prepare(
    `SELECT leave_type AS label, COUNT(*) AS count
     FROM leave_requests
     WHERE organization_id = ?
       AND start_date >= date('now', '-90 days')
     GROUP BY leave_type
     ORDER BY count DESC`,
  )
    .bind(org)
    .all<CountRow>()

  const { results: leaveStatusRows } = await c.env.DB.prepare(
    `SELECT status AS label, COUNT(*) AS count
     FROM leave_requests
     WHERE organization_id = ?
       AND start_date >= date('now', '-90 days')
     GROUP BY status`,
  )
    .bind(org)
    .all<CountRow>()

  const { results: leaveDaysRows } = await c.env.DB.prepare(
    `SELECT substr(start_date, 1, 7) AS ym, SUM(working_days) AS days
     FROM leave_requests
     WHERE organization_id = ? AND status = 'approved'
       AND start_date >= date('now', '-6 months', 'start of month')
     GROUP BY ym`,
  )
    .bind(org)
    .all<DaysRow>()

  const { results: stageRows } = await c.env.DB.prepare(
    `SELECT stage AS label, COUNT(*) AS count
     FROM candidates
     WHERE organization_id = ?
     GROUP BY stage
     ORDER BY count DESC`,
  )
    .bind(org)
    .all<CountRow>()

  const { results: tripStatusRows } = await c.env.DB.prepare(
    `SELECT status AS label, COUNT(*) AS count
     FROM trips
     WHERE organization_id = ?
     GROUP BY status`,
  )
    .bind(org)
    .all<CountRow>()

  const { results: alertLeave } = await c.env.DB.prepare(
    `SELECT e.full_name AS name, l.start_date AS when_at, l.leave_type AS detail
     FROM leave_requests l
     JOIN employees e ON e.id = l.employee_id
     WHERE l.organization_id = ? AND l.status = 'pending'
     ORDER BY l.start_date
     LIMIT 5`,
  )
    .bind(org)
    .all<{ name: string; when_at: string; detail: string }>()

  const { results: alertTrips } = await c.env.DB.prepare(
    `SELECT code AS name, start_at AS when_at, destination AS detail
     FROM trips
     WHERE organization_id = ? AND status IN ('pm','ph','st')
     ORDER BY start_at
     LIMIT 5`,
  )
    .bind(org)
    .all<{ name: string; when_at: string; detail: string }>()

  const { results: upcomingLeave } = await c.env.DB.prepare(
    `SELECT e.full_name AS name, l.start_date AS when_at,
            l.leave_type || ' · ' || CAST(l.working_days AS TEXT) || ' ngày' AS detail
     FROM leave_requests l
     JOIN employees e ON e.id = l.employee_id
     WHERE l.organization_id = ? AND l.status = 'approved'
       AND l.start_date >= ? AND l.start_date <= date(?, '+21 days')
     ORDER BY l.start_date
     LIMIT 6`,
  )
    .bind(org, today, today)
    .all<{ name: string; when_at: string; detail: string }>()

  const { results: upcomingTrips } = await c.env.DB.prepare(
    `SELECT code AS name, start_at AS when_at,
            destination || ' · ' || purpose AS detail
     FROM trips
     WHERE organization_id = ? AND status NOT IN ('rj','ok','draft')
       AND start_at >= ? AND start_at <= date(?, '+21 days')
     ORDER BY start_at
     LIMIT 6`,
  )
    .bind(org, today, today)
    .all<{ name: string; when_at: string; detail: string }>()

  const { results: contractsSoon } = await c.env.DB.prepare(
    `SELECT full_name AS name, code, contract_end AS when_at, title AS detail
     FROM employees
     WHERE organization_id = ? AND status = 'active'
       AND contract_end IS NOT NULL
       AND contract_end >= ? AND contract_end <= ?
     ORDER BY contract_end
     LIMIT 8`,
  )
    .bind(org, today, horizonIso)
    .all<{ name: string; code: string; when_at: string; detail: string }>()

  const { results: presenceTrend } = await c.env.DB.prepare(
    `SELECT work_date AS ym, COUNT(DISTINCT employee_id) AS n
     FROM attendance_punches
     WHERE organization_id = ?
       AND work_date >= date(?, '-13 days') AND work_date <= ?
     GROUP BY work_date
     ORDER BY work_date`,
  )
    .bind(org, today, today)
    .all<MonthRow>()

  const activeCount = Number(active?.n ?? 0)
  const leftCount = Number(left?.n ?? 0)
  const totalEver = activeCount + leftCount
  const turnover =
    totalEver > 0 ? Math.round((leftCount / totalEver) * 1000) / 10 : 0

  const hires = fillSeries(
    monthKeys,
    (hireRows ?? []).map((r) => ({ ym: r.ym, value: Number(r.n) })),
  )
  const exits = fillSeries(
    monthKeys,
    (leaveRows ?? []).map((r) => ({ ym: r.ym, value: Number(r.n) })),
  )
  const leaveDays = fillSeries(
    monthKeys,
    (leaveDaysRows ?? []).map((r) => ({
      ym: r.ym,
      value: Math.round(Number(r.days) * 10) / 10,
    })),
  )

  // Running headcount approximation: start from current and walk back
  let head = activeCount
  const headcountTrend: { month: string; value: number }[] = []
  for (let i = monthKeys.length - 1; i >= 0; i--) {
    headcountTrend.unshift({ month: monthKeys[i]!, value: Math.max(0, head) })
    head = head - (hires[i]?.value ?? 0) + (exits[i]?.value ?? 0)
  }

  const mapCount = (rows: CountRow[] | null | undefined) =>
    (rows ?? []).map((r) => ({
      label: r.label || '—',
      value: Number(r.count),
    }))

  return json(c, {
    activeEmployees: activeCount,
    leftEmployees: leftCount,
    turnover12mPct: turnover,
    presenceToday: Number(presence?.n ?? 0) || null,
    openTasks:
      Number(pendingLeave?.n ?? 0) +
      Number(pendingTrips?.n ?? 0) +
      Number(onboardingDue?.n ?? 0),
    openJobs: Number(openJobs?.n ?? 0),
    pipelineCandidates: Number(candidatesActive?.n ?? 0),
    onboardingDue: Number(onboardingDue?.n ?? 0),
    contractsEnding90d: Number(contractsEnding?.n ?? 0),
    pendingLeave: Number(pendingLeave?.n ?? 0),
    pendingTrips: Number(pendingTrips?.n ?? 0),
    byDepartment: mapCount(byDept),
    headcountTrend,
    hiresByMonth: hires,
    exitsByMonth: exits,
    leaveDaysByMonth: leaveDays,
    leaveByType: mapCount(leaveTypeRows),
    leaveByStatus: mapCount(leaveStatusRows),
    candidateFunnel: mapCount(stageRows),
    tripsByStatus: mapCount(tripStatusRows),
    alerts: [
      ...(alertLeave ?? []).map((a) => ({
        kind: 'leave' as const,
        title: a.name,
        when: a.when_at,
        detail: `Chờ duyệt: ${a.detail}`,
      })),
      ...(alertTrips ?? []).map((a) => ({
        kind: 'trip' as const,
        title: a.name,
        when: String(a.when_at).slice(0, 10),
        detail: `Công tác: ${a.detail}`,
      })),
      ...(contractsSoon ?? []).map((a) => ({
        kind: 'contract' as const,
        title: `${a.name} (${a.code})`,
        when: a.when_at,
        detail: `HĐ hết hạn — ${a.detail}`,
      })),
      ...(Number(onboardingDue?.n ?? 0) > 0
        ? [
            {
              kind: 'onboard' as const,
              title: 'Onboarding hết thử việc',
              when: today,
              detail: `${onboardingDue?.n} người cần chuyển hồ sơ NV chính thức`,
            },
          ]
        : []),
    ],
    upcoming: [
      ...(upcomingLeave ?? []).map((u) => ({
        kind: 'leave' as const,
        title: u.name,
        when: u.when_at,
        detail: u.detail,
      })),
      ...(upcomingTrips ?? []).map((u) => ({
        kind: 'trip' as const,
        title: u.name,
        when: String(u.when_at).slice(0, 10),
        detail: u.detail,
      })),
    ].sort((a, b) => a.when.localeCompare(b.when)),
    presenceTrend: (presenceTrend ?? []).map((r) => ({
      month: r.ym,
      value: Number(r.n),
    })),
    contractsEnding: (contractsSoon ?? []).map((c) => ({
      name: c.name,
      code: c.code,
      end: c.when_at,
      title: c.detail,
    })),
  })
})

dashboard.get('/travel', requireModule('trip', 1), async (c) => {
  const user = c.get('user')
  const org = user.organizationId
  const monthKeys = monthsBack(6)

  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(advance), 0) AS advance
     FROM trips WHERE organization_id = ?`,
  )
    .bind(org)
    .first<{ n: number; advance: number }>()

  const pending = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM trips
     WHERE organization_id = ? AND status IN ('pm','ph')`,
  )
    .bind(org)
    .first<{ n: number }>()

  const settle = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM trips
     WHERE organization_id = ? AND status IN ('ap','st')`,
  )
    .bind(org)
    .first<{ n: number }>()

  const done = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM trips
     WHERE organization_id = ? AND status = 'ok'`,
  )
    .bind(org)
    .first<{ n: number }>()

  const { results: byStatus } = await c.env.DB.prepare(
    `SELECT status AS label, COUNT(*) AS count
     FROM trips WHERE organization_id = ?
     GROUP BY status ORDER BY count DESC`,
  )
    .bind(org)
    .all<CountRow>()

  const { results: byDest } = await c.env.DB.prepare(
    `SELECT destination AS label, COUNT(*) AS count
     FROM trips WHERE organization_id = ?
     GROUP BY destination
     ORDER BY count DESC
     LIMIT 8`,
  )
    .bind(org)
    .all<CountRow>()

  const { results: byMonth } = await c.env.DB.prepare(
    `SELECT substr(start_at, 1, 7) AS ym, COUNT(*) AS n,
            COALESCE(SUM(advance), 0) AS days
     FROM trips
     WHERE organization_id = ?
       AND start_at >= date('now', '-6 months', 'start of month')
     GROUP BY ym`,
  )
    .bind(org)
    .all<{ ym: string; n: number; days: number }>()

  const tripCount = fillSeries(
    monthKeys,
    (byMonth ?? []).map((r) => ({ ym: r.ym, value: Number(r.n) })),
  )
  const advanceSeries = fillSeries(
    monthKeys,
    (byMonth ?? []).map((r) => ({ ym: r.ym, value: Number(r.days) })),
  )

  // Actual settled totals from actual_json when present
  const { results: settled } = await c.env.DB.prepare(
    `SELECT substr(start_at, 1, 7) AS ym, actual_json
     FROM trips
     WHERE organization_id = ? AND status = 'ok'
       AND start_at >= date('now', '-6 months', 'start of month')`,
  )
    .bind(org)
    .all<{ ym: string; actual_json: string | null }>()

  const settledMap = new Map<string, number>()
  for (const row of settled ?? []) {
    let totalAmt = 0
    try {
      const j = row.actual_json
        ? (JSON.parse(row.actual_json) as { total?: number })
        : {}
      totalAmt = Number(j.total ?? 0)
    } catch {
      totalAmt = 0
    }
    settledMap.set(row.ym, (settledMap.get(row.ym) ?? 0) + totalAmt)
  }
  const settledSeries = monthKeys.map((month) => ({
    month,
    value: settledMap.get(month) ?? 0,
  }))

  return json(c, {
    tripCount: Number(total?.n ?? 0),
    totalAdvance: Number(total?.advance ?? 0),
    pendingApprove: Number(pending?.n ?? 0),
    pendingSettle: Number(settle?.n ?? 0),
    completed: Number(done?.n ?? 0),
    byStatus: (byStatus ?? []).map((r) => ({
      label: r.label,
      value: Number(r.count),
    })),
    byDestination: (byDest ?? []).map((r) => ({
      label: r.label,
      value: Number(r.count),
    })),
    tripsByMonth: tripCount,
    advanceByMonth: advanceSeries,
    settledByMonth: settledSeries,
  })
})

export default dashboard
