import { useEffect, useMemo, useState } from 'react'
import { LineChart } from '../../components/charts'
import { fetchJson } from '../../lib/api'

type CycleCol = {
  id: string
  name: string
  short_label: string
  chart_label: string
  start_date: string
  end_date: string
  status: string
}

type Trend = {
  kind: 'up' | 'down' | 'stable' | 'insufficient'
  delta: number | null
  label: string
}

type Objective = {
  id: string
  period: string
  objective: string
  progress_pct: number
}

type EmployeeHistory = {
  employee_id: string
  employee_code: string
  employee_name: string
  department: string
  scores: Array<{ cycle_id: string; score: number | null }>
  trend: Trend
  objectives: Objective[]
}

type HistoryPayload = {
  cycles: CycleCol[]
  employees: EmployeeHistory[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: HistoryPayload }
  | { status: 'error'; message: string }

const LOW = 3.4

function formatScore(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

function scoreTone(score: number | null): 'low' | 'ok' | 'empty' {
  if (score == null) return 'empty'
  return score <= LOW ? 'low' : 'ok'
}

function TrendCell({ trend }: { trend: Trend }) {
  if (trend.kind === 'insufficient') {
    return <span className="ph-trend ph-trend--muted">{trend.label}</span>
  }
  if (trend.kind === 'stable') {
    return <span className="ph-trend ph-trend--stable">{trend.label}</span>
  }
  if (trend.kind === 'up') {
    return (
      <span className="ph-trend ph-trend--up">
        <span aria-hidden>▲</span> {trend.label}
      </span>
    )
  }
  return (
    <span className="ph-trend ph-trend--down">
      <span aria-hidden>▼</span> {trend.label}
    </span>
  )
}

export function PerfHistoryPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<HistoryPayload>('/api/performance/history')
      .then((data) => {
        if (cancelled) return
        setState({ status: 'ok', data })
        setSelectedId((prev) => {
          if (prev && data.employees.some((e) => e.employee_id === prev)) {
            return prev
          }
          return data.employees[0]?.employee_id ?? null
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          message:
            err instanceof Error ? err.message : 'Không tải được lịch sử hiệu suất',
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(() => {
    if (state.status !== 'ok' || !selectedId) return null
    return state.data.employees.find((e) => e.employee_id === selectedId) ?? null
  }, [state, selectedId])

  const chartData = useMemo(() => {
    if (state.status !== 'ok' || !selected) return []
    return state.data.cycles
      .map((cy) => {
        const hit = selected.scores.find((s) => s.cycle_id === cy.id)
        if (hit?.score == null) return null
        return { label: cy.chart_label, value: hit.score }
      })
      .filter((p): p is { label: string; value: number } => p != null)
  }, [state, selected])

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải lịch sử hiệu suất…</div>
  }

  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  const { cycles, employees } = state.data

  if (employees.length === 0) {
    return (
      <div className="card empty">
        <h2>Lịch sử hiệu suất</h2>
        <p>Chưa có đánh giá theo chu kỳ.</p>
      </div>
    )
  }

  return (
    <div className="stack ph-page">
      <div className="card table-card ph-table-card">
        <div className="ph-table-head">
          <h2>Lịch sử hiệu suất</h2>
        </div>
        <div className="table-wrap">
          <table className="data ph-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                {cycles.map((cy) => (
                  <th key={cy.id} className="ph-score-col">
                    {cy.short_label}
                  </th>
                ))}
                <th>Xu hướng</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const active = emp.employee_id === selectedId
                return (
                  <tr
                    key={emp.employee_id}
                    className={active ? 'row-selected ph-row-selected' : undefined}
                    onClick={() => setSelectedId(emp.employee_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedId(emp.employee_id)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={active}
                    aria-label={`Chọn ${emp.employee_name}`}
                  >
                    <td>
                      <div className="ph-emp">
                        <strong>{emp.employee_name}</strong>
                        <span className="muted small">{emp.department}</span>
                      </div>
                    </td>
                    {cycles.map((cy) => {
                      const score =
                        emp.scores.find((s) => s.cycle_id === cy.id)?.score ?? null
                      const tone = scoreTone(score)
                      return (
                        <td key={cy.id} className="ph-score-col">
                          {tone === 'empty' ? (
                            <span className="ph-score ph-score--empty">—</span>
                          ) : (
                            <span
                              className={`ph-score ph-score--${tone}`}
                              title={score != null ? String(score) : undefined}
                            >
                              {formatScore(score!)}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td>
                      <TrendCell trend={emp.trend} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ph-detail-grid">
        <div className="card ph-chart-card">
          <h2>
            {selected
              ? `${selected.employee_name}: điểm theo chu kỳ`
              : 'Điểm theo chu kỳ'}
          </h2>
          {chartData.length > 0 ? (
            <LineChart
              data={chartData}
              height={240}
              yMin={1}
              yMax={5}
              valueFormat={(n) => formatScore(n)}
            />
          ) : (
            <p className="empty muted">Chưa có điểm để vẽ biểu đồ.</p>
          )}
        </div>

        <div className="card ph-goals-card">
          <h2>Mục tiêu đang theo dõi</h2>
          {selected && selected.objectives.length > 0 ? (
            <ul className="ph-goals">
              {selected.objectives.map((o) => (
                <li key={o.id}>
                  <div className="ph-goal-meta">
                    <span className="ph-goal-text" title={o.objective}>
                      {o.objective}
                    </span>
                    <strong>{o.progress_pct}%</strong>
                  </div>
                  <div className="okr-progress-bar" aria-hidden>
                    <div style={{ width: `${Math.min(100, o.progress_pct)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty muted">Chưa có mục tiêu OKR cho nhân viên này.</p>
          )}
        </div>
      </div>
    </div>
  )
}
