import { useEffect, useState } from 'react'
import { BarChart, HBarChart } from '../../components/charts'
import { fetchJson } from '../../lib/api'

type Summary = {
  activeEmployees: number
  presenceToday: number | null
  leftEmployees: number
  turnover12mPct: number
  byDepartment: { label: string; value: number }[]
  presenceTrend: { month: string; value: number }[]
  exitsByMonth: { month: string; value: number }[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: Summary }
  | { status: 'error'; message: string }

export function PresencePage() {
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
    return <div className="card empty">Đang tải hiện diện…</div>
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
  const pct =
    data.presenceToday != null && data.activeEmployees > 0
      ? Math.round((data.presenceToday / data.activeEmployees) * 100)
      : null

  return (
    <div className="stack dash">
      <p className="page-lead muted">
        Chấm công hôm nay và xu hướng nghỉ việc 6 tháng gần nhất.
      </p>
      <div className="grid g4">
        <div className="tile">
          <div className="v">
            {data.presenceToday ?? '—'}
            {pct != null ? <span className="tile-sub">{pct}%</span> : null}
          </div>
          <div className="muted small">Có mặt hôm nay</div>
        </div>
        <div className="tile">
          <div className="v">{data.activeEmployees}</div>
          <div className="muted small">Đang làm việc</div>
        </div>
        <div className="tile">
          <div className="v">{data.leftEmployees}</div>
          <div className="muted small">Đã nghỉ (tích lũy)</div>
        </div>
        <div className="tile warn-tile">
          <div className="v">{data.turnover12mPct}%</div>
          <div className="muted small">Tỷ lệ nghỉ việc</div>
        </div>
      </div>
      <div className="grid g2">
        <div className="card chart-card">
          <h2>Hiện diện 14 ngày gần nhất</h2>
          <p className="ex">Số người có punch / ngày</p>
          <BarChart data={data.presenceTrend ?? []} />
        </div>
        <div className="card chart-card">
          <h2>Nghỉ việc theo tháng</h2>
          <BarChart data={data.exitsByMonth} />
        </div>
      </div>
      <div className="card chart-card">
        <h2>Headcount theo phòng ban</h2>
        <HBarChart data={data.byDepartment} />
      </div>
    </div>
  )
}
