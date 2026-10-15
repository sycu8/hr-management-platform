import { Hono } from 'hono'
import type { Env } from '../env.ts'
import { json, privateCacheHeaders } from '../lib/http.ts'
import {
  dashSummaryCacheKey,
  dashTravelCacheKey,
  kvGetJson,
  kvPutJsonBackground,
} from '../lib/kv-cache.ts'
import { requireAuth, type AuthUser } from '../middleware/auth.ts'
import { requireModule } from '../middleware/rbac.ts'

type CountRow = { label: string; count: number }
type MonthRow = { ym: string; n: number }
type DaysRow = { ym: string; days: number }

const SUMMARY_TTL = 45
const TRAVEL_TTL = 60

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

function row0<T>(batchItem: { results?: unknown[] }): T | undefined {
  return (batchItem.results ?? [])[0] as T | undefined
}

dashboard.get('/summary', requireModule('dash', 1), async (c) => {
  const user = c.get('user')
  const org = user.organizationId
  const today = new Date().toISOString().slice(0, 10)
  const cacheKey = dashSummaryCacheKey(org, today)

  const cached = await kvGetJson<Record<string, unknown>>(c.env, cacheKey)
  if (cached) {
    return json(c, cached, 200, privateCacheHeaders(SUMMARY_TTL, { hit: true }))
  }

  const horizon = new Date()
  horizon.setMonth(horizon.getMonth() + 3)
  const horizonIso = horizon.toISOString().slice(0, 10)
  const monthKeys = monthsBack(6)
  const db = c.env.DB

  const batch = await db.batch([
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM employees
         WHERE organization_id = ? AND status = 'active'`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM employees
         WHERE organization_id = ? AND status = 'left'`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM leave_requests
         WHERE organization_id = ? AND status = 'pending'`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM trips
         WHERE organization_id = ? AND status IN ('pm','ph','st','ap')`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM job_requisitions
         WHERE organization_id = ? AND status = 'open'`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM candidates
         WHERE organization_id = ?
           AND stage NOT IN ('hired','rejected','Nhận việc','Loại')`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM onboarding_plans
         WHERE organization_id = ?
           AND status != 'converted'
           AND (
             status = 'due_convert'
             OR (probation_end IS NOT NULL AND probation_end <= ?)
           )`,
      )
      .bind(org, today),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM employees
         WHERE organization_id = ? AND status = 'active'
           AND contract_end IS NOT NULL
           AND contract_end >= ? AND contract_end <= ?`,
      )
      .bind(org, today, horizonIso),
    db
      .prepare(
        `SELECT COUNT(DISTINCT employee_id) AS n FROM attendance_punches
         WHERE organization_id = ? AND work_date = ?`,
      )
      .bind(org, today),
    db
      .prepare(
        `SELECT department AS label, COUNT(*) AS count
         FROM employees
         WHERE organization_id = ? AND status = 'active'
         GROUP BY department
         ORDER BY count DESC, department`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT substr(joined_on, 1, 7) AS ym, COUNT(*) AS n
         FROM employees
         WHERE organization_id = ? AND joined_on IS NOT NULL
           AND joined_on >= date('now', '-6 months', 'start of month')
         GROUP BY ym`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT substr(left_on, 1, 7) AS ym, COUNT(*) AS n
         FROM employees
         WHERE organization_id = ? AND left_on IS NOT NULL
           AND left_on >= date('now', '-6 months', 'start of month')
         GROUP BY ym`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT leave_type AS label, COUNT(*) AS count
         FROM leave_requests
         WHERE organization_id = ?
           AND start_date >= date('now', '-90 days')
         GROUP BY leave_type
         ORDER BY count DESC`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT status AS label, COUNT(*) AS count
         FROM leave_requests
         WHERE organization_id = ?
           AND start_date >= date('now', '-90 days')
         GROUP BY status`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT substr(start_date, 1, 7) AS ym, SUM(working_days) AS days
         FROM leave_requests
         WHERE organization_id = ? AND status = 'approved'
           AND start_date >= date('now', '-6 months', 'start of month')
         GROUP BY ym`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT stage AS label, COUNT(*) AS count
         FROM candidates
         WHERE organization_id = ?
         GROUP BY stage
         ORDER BY count DESC`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT status AS label, COUNT(*) AS count
         FROM trips
         WHERE organization_id = ?
         GROUP BY status`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT l.id, e.full_name AS name, l.start_date AS when_at, l.leave_type AS detail
         FROM leave_requests l
         JOIN employees e ON e.id = l.employee_id
         WHERE l.organization_id = ? AND l.status = 'pending'
         ORDER BY l.start_date
         LIMIT 8`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT id, code AS name, start_at AS when_at, destination AS detail, status
         FROM trips
         WHERE organization_id = ? AND status IN ('pm','ph','st','ap')
         ORDER BY
           CASE status WHEN 'pm' THEN 0 WHEN 'ph' THEN 1 WHEN 'st' THEN 2 ELSE 3 END,
           start_at
         LIMIT 8`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT id, title AS name, deadline AS when_at, department AS detail
         FROM job_requisitions
         WHERE organization_id = ? AND status = 'open'
           AND deadline IS NOT NULL AND deadline <= date(?, '+21 days')
         ORDER BY deadline
         LIMIT 5`,
      )
      .bind(org, today),
    db
      .prepare(
        `SELECT id, full_name AS name, COALESCE(interview_at, updated_at) AS when_at,
                stage AS detail
         FROM candidates
         WHERE organization_id = ? AND stage IN ('offer','Offer')
         ORDER BY updated_at DESC
         LIMIT 5`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT e.full_name AS name, l.start_date AS when_at,
                l.leave_type || ' · ' || CAST(l.working_days AS TEXT) || ' ngày' AS detail
         FROM leave_requests l
         JOIN employees e ON e.id = l.employee_id
         WHERE l.organization_id = ? AND l.status = 'approved'
           AND l.start_date >= ? AND l.start_date <= date(?, '+21 days')
         ORDER BY l.start_date
         LIMIT 6`,
      )
      .bind(org, today, today),
    db
      .prepare(
        `SELECT code AS name, start_at AS when_at,
                destination || ' · ' || purpose AS detail
         FROM trips
         WHERE organization_id = ? AND status NOT IN ('rj','ok','draft')
           AND start_at >= ? AND start_at <= date(?, '+21 days')
         ORDER BY start_at
         LIMIT 6`,
      )
      .bind(org, today, today),
    db
      .prepare(
        `SELECT full_name AS name, code, contract_end AS when_at, title AS detail
         FROM employees
         WHERE organization_id = ? AND status = 'active'
           AND contract_end IS NOT NULL
           AND contract_end >= ? AND contract_end <= ?
         ORDER BY contract_end
         LIMIT 8`,
      )
      .bind(org, today, horizonIso),
    db
      .prepare(
        `SELECT work_date AS ym, COUNT(DISTINCT employee_id) AS n
         FROM attendance_punches
         WHERE organization_id = ?
           AND work_date >= date(?, '-13 days') AND work_date <= ?
         GROUP BY work_date
         ORDER BY work_date`,
      )
      .bind(org, today, today),
  ])

  const active = row0<{ n: number }>(batch[0]!)
  const left = row0<{ n: number }>(batch[1]!)
  const pendingLeave = row0<{ n: number }>(batch[2]!)
  const pendingTrips = row0<{ n: number }>(batch[3]!)
  const openJobs = row0<{ n: number }>(batch[4]!)
  const candidatesActive = row0<{ n: number }>(batch[5]!)
  const onboardingDue = row0<{ n: number }>(batch[6]!)
  const contractsEnding = row0<{ n: number }>(batch[7]!)
  const presence = row0<{ n: number }>(batch[8]!)
  const byDept = (batch[9]!.results ?? []) as CountRow[]
  const hireRows = (batch[10]!.results ?? []) as MonthRow[]
  const leaveRows = (batch[11]!.results ?? []) as MonthRow[]
  const leaveTypeRows = (batch[12]!.results ?? []) as CountRow[]
  const leaveStatusRows = (batch[13]!.results ?? []) as CountRow[]
  const leaveDaysRows = (batch[14]!.results ?? []) as DaysRow[]
  const stageRows = (batch[15]!.results ?? []) as CountRow[]
  const tripStatusRows = (batch[16]!.results ?? []) as CountRow[]
  const alertLeave = (batch[17]!.results ?? []) as {
    id: string
    name: string
    when_at: string
    detail: string
  }[]
  const alertTrips = (batch[18]!.results ?? []) as {
    id: string
    name: string
    when_at: string
    detail: string
    status: string
  }[]
  const alertJobs = (batch[19]!.results ?? []) as {
    id: string
    name: string
    when_at: string
    detail: string
  }[]
  const alertOffer = (batch[20]!.results ?? []) as {
    id: string
    name: string
    when_at: string
    detail: string
  }[]
  const upcomingLeave = (batch[21]!.results ?? []) as {
    name: string
    when_at: string
    detail: string
  }[]
  const upcomingTrips = (batch[22]!.results ?? []) as {
    name: string
    when_at: string
    detail: string
  }[]
  const contractsSoon = (batch[23]!.results ?? []) as {
    name: string
    code: string
    when_at: string
    detail: string
  }[]
  const presenceTrend = (batch[24]!.results ?? []) as MonthRow[]

  const activeCount = Number(active?.n ?? 0)
  const leftCount = Number(left?.n ?? 0)
  const totalEver = activeCount + leftCount
  const turnover =
    totalEver > 0 ? Math.round((leftCount / totalEver) * 1000) / 10 : 0

  const hires = fillSeries(
    monthKeys,
    hireRows.map((r) => ({ ym: r.ym, value: Number(r.n) })),
  )
  const exits = fillSeries(
    monthKeys,
    leaveRows.map((r) => ({ ym: r.ym, value: Number(r.n) })),
  )
  const leaveDays = fillSeries(
    monthKeys,
    leaveDaysRows.map((r) => ({
      ym: r.ym,
      value: Math.round(Number(r.days) * 10) / 10,
    })),
  )

  let head = activeCount
  const headcountTrend: { month: string; value: number }[] = []
  for (let i = monthKeys.length - 1; i >= 0; i--) {
    headcountTrend.unshift({ month: monthKeys[i]!, value: Math.max(0, head) })
    head = head - (hires[i]?.value ?? 0) + (exits[i]?.value ?? 0)
  }

  const mapCount = (rows: CountRow[]) =>
    rows.map((r) => ({
      label: r.label || '—',
      value: Number(r.count),
    }))

  const payload = {
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
      ...alertLeave.map((a) => ({
        kind: 'leave' as const,
        title: a.name,
        when: a.when_at,
        detail: `Chờ duyệt nghỉ: ${a.detail}`,
        href: '/leave',
        action: 'Duyệt phép',
        entityId: a.id,
      })),
      ...alertTrips.map((a) => {
        const settle = a.status === 'st' || a.status === 'ap'
        return {
          kind: 'trip' as const,
          title: a.name,
          when: String(a.when_at).slice(0, 10),
          detail: settle
            ? `Quyết toán công tác: ${a.detail}`
            : `Chờ phê duyệt công tác: ${a.detail}`,
          href: settle ? '/travel/settlements' : '/travel/approvals',
          action: settle ? 'Quyết toán' : 'Phê duyệt',
          entityId: a.id,
        }
      }),
      ...contractsSoon.map((a) => ({
        kind: 'contract' as const,
        title: `${a.name} (${a.code})`,
        when: a.when_at,
        detail: `HĐ hết hạn — ${a.detail}`,
        href: '/employees/jobs',
        action: 'Xem hồ sơ CV',
        entityId: a.code,
      })),
      ...(Number(onboardingDue?.n ?? 0) > 0
        ? [
            {
              kind: 'onboard' as const,
              title: 'Onboarding hết thử việc',
              when: today,
              detail: `${onboardingDue?.n} người cần chuyển hồ sơ NV chính thức`,
              href: '/recruitment/onboarding',
              action: 'Xử lý onboarding',
              entityId: null as string | null,
            },
          ]
        : []),
      ...alertJobs.map((a) => ({
        kind: 'job' as const,
        title: a.name,
        when: a.when_at,
        detail: `Tin tuyển ${a.detail} — hạn nhận hồ sơ`,
        href: '/recruitment/jobs',
        action: 'Xem tin tuyển',
        entityId: a.id,
      })),
      ...alertOffer.map((a) => ({
        kind: 'candidate' as const,
        title: a.name,
        when: String(a.when_at).slice(0, 10),
        detail: `Ứng viên ở bước Offer — cần phản hồi`,
        href: '/recruitment/candidates',
        action: 'Theo dõi UV',
        entityId: a.id,
      })),
    ],
    upcoming: [
      ...upcomingLeave.map((u) => ({
        kind: 'leave' as const,
        title: u.name,
        when: u.when_at,
        detail: u.detail,
        href: '/leave/calendar',
      })),
      ...upcomingTrips.map((u) => ({
        kind: 'trip' as const,
        title: u.name,
        when: String(u.when_at).slice(0, 10),
        detail: u.detail,
        href: '/travel/trips',
      })),
    ].sort((a, b) => a.when.localeCompare(b.when)),
    presenceTrend: presenceTrend.map((r) => ({
      month: r.ym,
      value: Number(r.n),
    })),
    contractsEnding: contractsSoon.map((row) => ({
      name: row.name,
      code: row.code,
      end: row.when_at,
      title: row.detail,
      href: '/employees/jobs',
    })),
  }

  kvPutJsonBackground(c.env, c.executionCtx, cacheKey, payload, SUMMARY_TTL)
  return json(c, payload, 200, privateCacheHeaders(SUMMARY_TTL, { hit: false }))
})

dashboard.get('/travel', requireModule('trip', 1), async (c) => {
  const user = c.get('user')
  const org = user.organizationId
  const cacheKey = dashTravelCacheKey(org)

  const cached = await kvGetJson<Record<string, unknown>>(c.env, cacheKey)
  if (cached) {
    return json(c, cached, 200, privateCacheHeaders(TRAVEL_TTL, { hit: true }))
  }

  const monthKeys = monthsBack(6)
  const db = c.env.DB

  const batch = await db.batch([
    db
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(advance), 0) AS advance
         FROM trips WHERE organization_id = ?`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM trips
         WHERE organization_id = ? AND status IN ('pm','ph')`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM trips
         WHERE organization_id = ? AND status IN ('ap','st')`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM trips
         WHERE organization_id = ? AND status = 'ok'`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT status AS label, COUNT(*) AS count
         FROM trips WHERE organization_id = ?
         GROUP BY status ORDER BY count DESC`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT destination AS label, COUNT(*) AS count
         FROM trips WHERE organization_id = ?
         GROUP BY destination
         ORDER BY count DESC
         LIMIT 8`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT substr(start_at, 1, 7) AS ym, COUNT(*) AS n,
                COALESCE(SUM(advance), 0) AS days
         FROM trips
         WHERE organization_id = ?
           AND start_at >= date('now', '-6 months', 'start of month')
         GROUP BY ym`,
      )
      .bind(org),
    db
      .prepare(
        `SELECT substr(start_at, 1, 7) AS ym, actual_json
         FROM trips
         WHERE organization_id = ? AND status = 'ok'
           AND start_at >= date('now', '-6 months', 'start of month')`,
      )
      .bind(org),
  ])

  const total = row0<{ n: number; advance: number }>(batch[0]!)
  const pending = row0<{ n: number }>(batch[1]!)
  const settle = row0<{ n: number }>(batch[2]!)
  const done = row0<{ n: number }>(batch[3]!)
  const byStatus = (batch[4]!.results ?? []) as CountRow[]
  const byDest = (batch[5]!.results ?? []) as CountRow[]
  const byMonth = (batch[6]!.results ?? []) as {
    ym: string
    n: number
    days: number
  }[]
  const settled = (batch[7]!.results ?? []) as {
    ym: string
    actual_json: string | null
  }[]

  const tripCount = fillSeries(
    monthKeys,
    byMonth.map((r) => ({ ym: r.ym, value: Number(r.n) })),
  )
  const advanceSeries = fillSeries(
    monthKeys,
    byMonth.map((r) => ({ ym: r.ym, value: Number(r.days) })),
  )

  const settledMap = new Map<string, number>()
  for (const row of settled) {
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

  const payload = {
    tripCount: Number(total?.n ?? 0),
    totalAdvance: Number(total?.advance ?? 0),
    pendingApprove: Number(pending?.n ?? 0),
    pendingSettle: Number(settle?.n ?? 0),
    completed: Number(done?.n ?? 0),
    byStatus: byStatus.map((r) => ({
      label: r.label,
      value: Number(r.count),
    })),
    byDestination: byDest.map((r) => ({
      label: r.label,
      value: Number(r.count),
    })),
    tripsByMonth: tripCount,
    advanceByMonth: advanceSeries,
    settledByMonth: settledSeries,
  }

  kvPutJsonBackground(c.env, c.executionCtx, cacheKey, payload, TRAVEL_TTL)
  return json(c, payload, 200, privateCacheHeaders(TRAVEL_TTL, { hit: false }))
})

export default dashboard
