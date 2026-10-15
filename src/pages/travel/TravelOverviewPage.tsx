import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, DonutChart, HBarChart } from '../../components/charts'
import { fetchJson } from '../../lib/api'

type Point = { label: string; value: number }
type Series = { month: string; value: number }

type TravelOverview = {
  tripCount: number
  totalAdvance: number
  pendingApprove: number
  pendingSettle: number
  completed: number
  byStatus: Point[]
  byDestination: Point[]
  tripsByMonth: Series[]
  advanceByMonth: Series[]
  settledByMonth: Series[]
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

function vnd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return n.toLocaleString('vi-VN')
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: TravelOverview }
  | { status: 'error'; message: string }

export function TravelOverviewPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetchJson<TravelOverview>('/api/dashboard/travel')
      .then((data) => {
        if (!cancelled) setState({ status: 'ok', data })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Không tải được tổng quan',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải tổng quan công tác…</div>
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
      <div className="dash-intro">
        <p className="page-lead muted">
          Pipeline phê duyệt, quyết toán và chi phí công tác theo thời gian.
        </p>
        <div className="dash-actions">
          <Link className="btn ghost" to="/travel/approvals">
            Phê duyệt
          </Link>
          <Link className="btn ghost" to="/travel/settlements">
            Quyết toán
          </Link>
          <Link className="btn primary" to="/travel/trips">
            Đề nghị
          </Link>
        </div>
      </div>

      <div className="grid g4">
        <div className="tile">
          <div className="v">{data.tripCount}</div>
          <div className="muted small">Tổng đề nghị</div>
        </div>
        <div className="tile warn-tile">
          <div className="v">{data.pendingApprove}</div>
          <div className="muted small">Chờ phê duyệt</div>
        </div>
        <div className="tile warn-tile">
          <div className="v">{data.pendingSettle}</div>
          <div className="muted small">Chờ / đang quyết toán</div>
        </div>
        <div className="tile">
          <div className="v">{vnd(data.totalAdvance)}</div>
          <div className="muted small">Tổng tạm ứng (₫)</div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card chart-card">
          <h2>Số chuyến theo tháng</h2>
          <BarChart data={data.tripsByMonth} />
        </div>
        <div className="card chart-card">
          <h2>Chi phí quyết toán theo tháng</h2>
          <p className="ex">Tổng từ actual_json các chuyến hoàn tất</p>
          <BarChart data={data.settledByMonth} valueFormat={vnd} />
        </div>
      </div>

      <div className="grid g2">
        <div className="card chart-card">
          <h2>Tạm ứng theo tháng</h2>
          <BarChart data={data.advanceByMonth} valueFormat={vnd} />
        </div>
        <div className="card chart-card">
          <h2>Phân bố trạng thái</h2>
          <DonutChart
            data={data.byStatus}
            labelMap={TRIP_STATUS}
            centerLabel="chuyến"
            centerValue={data.tripCount}
          />
        </div>
      </div>

      <div className="card chart-card">
        <h2>Điểm đến phổ biến</h2>
        <HBarChart data={data.byDestination} />
      </div>
    </div>
  )
}
