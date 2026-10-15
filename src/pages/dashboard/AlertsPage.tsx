import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '../../lib/api'

type Alert = { kind: string; title: string; when: string; detail: string }
type Contract = { name: string; code: string; end: string; title: string }

type Summary = {
  alerts: Alert[]
  contractsEnding: Contract[]
  pendingLeave: number
  pendingTrips: number
  onboardingDue: number
  contractsEnding90d: number
  openTasks: number
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: Summary }
  | { status: 'error'; message: string }

const KIND_LABEL: Record<string, string> = {
  leave: 'Nghỉ phép',
  trip: 'Công tác',
  contract: 'Hợp đồng',
  onboard: 'Onboarding',
}

export function AlertsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<Summary>('/api/dashboard/summary')
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Không tải được',
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải cảnh báo…</div>
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

  return (
    <div className="stack dash">
      <p className="page-lead muted">
        Việc cần xử lý: duyệt phép / công tác, HĐ sắp hết hạn, hết thử việc.
      </p>
      <div className="grid g4 kpi-row">
        <Link to="/leave" className="kpi-chip">
          <strong>{data.pendingLeave}</strong>
          <span>Đơn phép chờ duyệt</span>
        </Link>
        <Link to="/travel/approvals" className="kpi-chip">
          <strong>{data.pendingTrips}</strong>
          <span>Công tác chờ xử lý</span>
        </Link>
        <Link to="/employees/jobs" className="kpi-chip">
          <strong>{data.contractsEnding90d}</strong>
          <span>HĐ hết hạn ≤ 90 ngày</span>
        </Link>
        <Link to="/recruitment/onboarding" className="kpi-chip">
          <strong>{data.onboardingDue}</strong>
          <span>Cần chuyển chính thức</span>
        </Link>
      </div>
      <div className="card">
        <h2>Danh sách nhắc ({data.alerts.length})</h2>
        {data.alerts.length === 0 ? (
          <p className="empty">Không có cảnh báo.</p>
        ) : (
          <ul className="feed-list">
            {data.alerts.map((a, i) => (
              <li key={`${a.kind}-${a.title}-${i}`}>
                <div className="feed-when">{a.when}</div>
                <div>
                  <span className="muted small">
                    {KIND_LABEL[a.kind] ?? a.kind}
                  </span>
                  <div>
                    <strong>{a.title}</strong>
                  </div>
                  <div className="muted small">{a.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {data.contractsEnding?.length ? (
        <div className="card">
          <h2>Hợp đồng sắp hết hạn</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nhân viên</th>
                  <th>Vị trí</th>
                  <th>Hết hạn</th>
                </tr>
              </thead>
              <tbody>
                {data.contractsEnding.map((c) => (
                  <tr key={c.code} className="row-warn">
                    <td className="mono">{c.code}</td>
                    <td>{c.name}</td>
                    <td>{c.title}</td>
                    <td className="mono">{c.end}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
