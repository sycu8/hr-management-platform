import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  DonutChart,
  DualBarChart,
  FunnelChart,
  HBarChart,
} from '../../components/charts'
import { QuickHub } from '../../components/QuickHub'
import { fetchJson } from '../../lib/api'

type Point = { label: string; value: number }
type Series = { month: string; value: number }

type DashboardSummary = {
  activeEmployees: number
  leftEmployees: number
  turnover12mPct: number
  presenceToday: number | null
  openTasks: number
  openJobs: number
  pipelineCandidates: number
  onboardingDue: number
  contractsEnding90d: number
  pendingLeave: number
  pendingTrips: number
  byDepartment: Point[]
  headcountTrend: Series[]
  hiresByMonth: Series[]
  exitsByMonth: Series[]
  leaveDaysByMonth: Series[]
  leaveByType: Point[]
  leaveByStatus: Point[]
  candidateFunnel: Point[]
  tripsByStatus: Point[]
  alerts: {
    kind: string
    title: string
    when: string
    detail: string
    href?: string
    action?: string
  }[]
  upcoming: {
    kind?: string
    title: string
    when: string
    detail: string
    href?: string
  }[]
  presenceTrend?: { month: string; value: number }[]
  contractsEnding?: {
    name: string
    code: string
    end: string
    title: string
    href?: string
  }[]
}

const LEAVE_STATUS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Hủy',
}

const TRIP_STATUS: Record<string, string> = {
  draft: 'Nháp',
  pm: 'Chờ QL',
  ph: 'Chờ HR',
  ap: 'Đã duyệt',
  st: 'Quyết toán',
  ok: 'Hoàn tất',
  rj: 'Từ chối',
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: DashboardSummary }
  | { status: 'error'; message: string }

export function DashboardPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<DashboardSummary>('/api/dashboard/summary')
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : 'Không tải được tổng quan'
        setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải tổng quan nhân sự…</div>
  }

  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  const { data } = state
  const presencePct =
    data.presenceToday != null && data.activeEmployees > 0
      ? Math.round((data.presenceToday / data.activeEmployees) * 100)
      : null

  return (
    <div className="stack dash">
      <QuickHub />

      <div className="grid g4">
        <div className="tile">
          <div className="v">{data.activeEmployees}</div>
          <div className="muted small">Đang làm việc</div>
        </div>
        <div className="tile">
          <div className="v">
            {data.presenceToday == null ? '—' : data.presenceToday}
            {presencePct != null ? (
              <span className="tile-sub">{presencePct}%</span>
            ) : null}
          </div>
          <div className="muted small">Hiện diện hôm nay</div>
        </div>
        <div className="tile">
          <div className="v">{data.turnover12mPct}%</div>
          <div className="muted small">Tỷ lệ nghỉ việc (tích lũy)</div>
        </div>
        <div className="tile warn-tile">
          <div className="v">{data.openTasks}</div>
          <div className="muted small">Việc cần xử lý</div>
        </div>
      </div>

      <div className="grid g4 kpi-row">
        <Link to="/recruitment/jobs" className="kpi-chip">
          <strong>{data.openJobs}</strong>
          <span>Vị trí đang tuyển</span>
        </Link>
        <Link to="/recruitment/candidates" className="kpi-chip">
          <strong>{data.pipelineCandidates}</strong>
          <span>Ứng viên trong pipeline</span>
        </Link>
        <Link to="/recruitment/onboarding" className="kpi-chip">
          <strong>{data.onboardingDue}</strong>
          <span>Hết TV — cần chuyển NV</span>
        </Link>
        <Link to="/employees/jobs" className="kpi-chip">
          <strong>{data.contractsEnding90d}</strong>
          <span>HĐ hết hạn ≤ 90 ngày</span>
        </Link>
      </div>

      <div className="grid g2">
        <div className="card chart-card">
          <h2>Biên chế theo tháng</h2>
          <p className="ex">Ước lượng headcount từ tuyển mới / nghỉ việc</p>
          <BarChart data={data.headcountTrend} />
        </div>
        <div className="card chart-card">
          <h2>Tuyển mới vs nghỉ việc</h2>
          <p className="ex">6 tháng gần nhất</p>
          <DualBarChart
            a={data.hiresByMonth}
            b={data.exitsByMonth}
            aLabel="Tuyển mới"
            bLabel="Nghỉ việc"
          />
        </div>
      </div>

      <div className="grid g2">
        <div className="card chart-card">
          <h2>Nhân sự theo phòng ban</h2>
          <HBarChart data={data.byDepartment} />
        </div>
        <div className="card chart-card">
          <h2>Phễu tuyển dụng</h2>
          <p className="ex">Số ứng viên theo giai đoạn</p>
          <FunnelChart data={data.candidateFunnel} />
        </div>
      </div>

      <div className="grid g2">
        <div className="card chart-card">
          <h2>Ngày nghỉ đã duyệt</h2>
          <p className="ex">Tổng ngày công nghỉ / tháng</p>
          <BarChart data={data.leaveDaysByMonth} />
        </div>
        <div className="card chart-card">
          <h2>Nghỉ phép theo loại (90 ngày)</h2>
          <DonutChart
            data={data.leaveByType}
            centerLabel="đơn"
            centerValue={data.leaveByType.reduce((s, x) => s + x.value, 0)}
          />
        </div>
      </div>

      <div className="grid g2">
        <div className="card chart-card">
          <h2>Trạng thái đơn nghỉ</h2>
          <DonutChart data={data.leaveByStatus} labelMap={LEAVE_STATUS} />
          <p className="ex">
            Đang chờ duyệt: <strong>{data.pendingLeave}</strong> —{' '}
            <Link to="/leave">Xử lý</Link>
          </p>
        </div>
        <div className="card chart-card">
          <h2>Công tác theo trạng thái</h2>
          <DonutChart data={data.tripsByStatus} labelMap={TRIP_STATUS} />
          <p className="ex">
            Chờ xử lý: <strong>{data.pendingTrips}</strong> —{' '}
            <Link to="/travel">Tổng quan công tác</Link>
          </p>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Cảnh báo &amp; nhắc việc</h2>
          {data.alerts.length === 0 ? (
            <p className="empty">Không có cảnh báo.</p>
          ) : (
            <ul className="feed-list">
              {data.alerts.map((a, i) => {
                const body = (
                  <>
                    <div className="feed-when">{a.when}</div>
                    <div className="feed-body">
                      <strong>{a.title}</strong>
                      <div className="muted small">{a.detail}</div>
                      {a.action ? (
                        <span className="feed-action">{a.action} →</span>
                      ) : null}
                    </div>
                  </>
                )
                return (
                  <li key={`${a.kind}-${a.title}-${i}`}>
                    {a.href ? (
                      <Link to={a.href} className="feed-link">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="card">
          <h2>Nghỉ phép sắp tới (21 ngày)</h2>
          {data.upcoming.length === 0 ? (
            <p className="empty">Không có lịch nghỉ sắp tới.</p>
          ) : (
            <ul className="feed-list">
              {data.upcoming.map((u, i) => {
                const body = (
                  <>
                    <div className="feed-when">{u.when}</div>
                    <div className="feed-body">
                      <strong>{u.title}</strong>
                      <div className="muted small">{u.detail}</div>
                    </div>
                  </>
                )
                return (
                  <li key={`${u.title}-${u.when}-${i}`}>
                    {u.href ? (
                      <Link to={u.href} className="feed-link">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
