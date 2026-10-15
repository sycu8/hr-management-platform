import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type KeyResult = {
  kr: string
  progress: number
  target?: number
  current?: number
  unit?: string
  note?: string
}

type OkrItem = {
  id: string
  employee_id: string
  employee_code: string
  employee_name: string
  department: string
  title: string
  period: string
  period_label: string
  year: number | null
  quarters: number[]
  objective: string
  key_results: KeyResult[]
  progress_pct: number
  completeness: string
  completeness_label: string
  updated_at: string
}

type QuarterSummary = {
  quarter: number
  label: string
  headcount: number
  with_okr: number
  enough: number
  missing: number
  thin: number
  done: number
  avg_progress_pct: number
  coverage_pct: number
  enough_pct: number
  employees: Array<{
    employee_id: string
    employee_code: string
    employee_name: string
    department: string
    completeness: string
    completeness_label: string
    progress_pct: number
    objectives: OkrItem[]
  }>
}

type Summary = {
  year: number
  headcount: number
  year_avg_progress_pct: number
  quarters: QuarterSummary[]
}

type Tab = 'mine' | 'manager' | 'year'

function tone(completeness: string) {
  if (completeness === 'done') return 'good'
  if (completeness === 'on_track') return ''
  if (completeness === 'missing' || completeness === 'thin') return 'bad'
  return 'warn'
}

function pct(n: number) {
  return `${Math.round(n)}%`
}

export function OkrPage() {
  const { user } = useAuth()
  const canEditAll = !!user?.canEditData
  const hasSelf = !!user?.employeeId
  const [tab, setTab] = useState<Tab>(hasSelf ? 'mine' : 'manager')
  const [year, setYear] = useState(2026)
  const [quarter, setQuarter] = useState<number | 'all'>('all')
  const [mine, setMine] = useState<OkrItem[]>([])
  const [team, setTeam] = useState<OkrItem[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [activeQ, setActiveQ] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, KeyResult[]>>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    period: '2026-Q4',
    objective: '',
    kr1: '',
    kr2: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qParam = quarter === 'all' ? '' : `&quarter=${quarter}`
      const [mineRes, teamRes, sumRes] = await Promise.all([
        hasSelf
          ? fetchJson<{ items: OkrItem[] }>(
              `/api/okr?scope=mine&year=${year}${qParam}`,
            )
          : Promise.resolve({ items: [] as OkrItem[] }),
        fetchJson<{ items: OkrItem[] }>(
          `/api/okr?scope=team&year=${year}${qParam}`,
        ),
        fetchJson<Summary>(
          `/api/okr/summary?year=${year}&scope=${canEditAll ? 'all' : 'team'}`,
        ),
      ])
      setMine(mineRes.items)
      setTeam(teamRes.items)
      setSummary(sumRes)
      const d: Record<string, KeyResult[]> = {}
      for (const o of mineRes.items) d[o.id] = o.key_results.map((k) => ({ ...k }))
      setDrafts(d)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được OKR')
    } finally {
      setLoading(false)
    }
  }, [year, quarter, hasSelf, canEditAll])

  useEffect(() => {
    void load()
  }, [load])

  const years = useMemo(() => [2025, 2026, 2027], [])

  async function saveMine(id: string) {
    const krs = drafts[id]
    if (!krs) return
    setSavingId(id)
    try {
      await fetchJson(`/api/okr/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ key_results: krs }),
      })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không lưu được')
    } finally {
      setSavingId(null)
    }
  }

  async function createMine() {
    if (!createForm.objective.trim() || !createForm.kr1.trim()) {
      setError('Cần mục tiêu và ít nhất 1 KR')
      return
    }
    const key_results = [
      { kr: createForm.kr1.trim(), progress: 0 },
      ...(createForm.kr2.trim()
        ? [{ kr: createForm.kr2.trim(), progress: 0 }]
        : []),
    ]
    try {
      await fetchJson('/api/okr', {
        method: 'POST',
        body: JSON.stringify({
          period: createForm.period,
          objective: createForm.objective.trim(),
          key_results,
        }),
      })
      setCreateOpen(false)
      setCreateForm({
        period: `${year}-Q${quarter === 'all' ? 4 : quarter}`,
        objective: '',
        kr1: '',
        kr2: '',
      })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tạo được OKR')
    }
  }

  const qSummary = summary?.quarters.find((q) => q.quarter === activeQ)

  if (loading && !summary && mine.length === 0) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải KPI / OKR…</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="page-lead muted">
        Nhân viên cập nhật tiến độ KR; quản lý xem đã đủ OKR chưa, hoàn thành bao
        nhiêu theo từng quý và cả năm.
      </p>

      {error ? <p className="warn-text">{error}</p> : null}

      <div className="toolbar filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 6 }}>
          {(
            [
              hasSelf ? (['mine', 'Của tôi'] as const) : null,
              ['manager', 'Nhóm / đủ chưa'] as const,
              ['year', 'Theo năm'] as const,
            ] as Array<readonly [Tab, string] | null>
          )
            .filter(Boolean)
            .map((pair) => {
              const [id, label] = pair!
              return (
                <button
                  key={id}
                  type="button"
                  className={`btn ${tab === id ? 'primary' : 'ghost'}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              )
            })}
        </div>
        <div className="sp" style={{ flex: 1 }} />
        <label className="muted small">
          Năm{' '}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {tab !== 'year' ? (
          <label className="muted small">
            Quý{' '}
            <select
              value={quarter}
              onChange={(e) => {
                const v = e.target.value
                setQuarter(v === 'all' ? 'all' : Number(v))
              }}
            >
              <option value="all">Cả năm</option>
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </label>
        ) : null}
      </div>

      {tab === 'mine' && hasSelf ? (
        <div className="stack">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>OKR của tôi · {year}</h2>
            <button
              type="button"
              className="btn primary"
              onClick={() => setCreateOpen((v) => !v)}
            >
              {createOpen ? 'Đóng' : '+ Thêm mục tiêu'}
            </button>
          </div>

          {createOpen ? (
            <div className="card">
              <h3>Thêm OKR</h3>
              <div className="form-grid">
                <label>
                  Kỳ
                  <select
                    value={createForm.period}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, period: e.target.value }))
                    }
                  >
                    {[1, 2, 3, 4].map((q) => (
                      <option key={q} value={`${year}-Q${q}`}>
                        {year}-Q{q}
                      </option>
                    ))}
                    <option value={`${year}-H1`}>{year}-H1</option>
                    <option value={`${year}-H2`}>{year}-H2</option>
                  </select>
                </label>
                <label className="span2">
                  Mục tiêu (O)
                  <input
                    value={createForm.objective}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        objective: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Đạt doanh số cá nhân…"
                  />
                </label>
                <label className="span2">
                  Key result 1
                  <input
                    value={createForm.kr1}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, kr1: e.target.value }))
                    }
                  />
                </label>
                <label className="span2">
                  Key result 2 (khuyến nghị)
                  <input
                    value={createForm.kr2}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, kr2: e.target.value }))
                    }
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn primary"
                style={{ marginTop: 12 }}
                onClick={() => void createMine()}
              >
                Lưu OKR
              </button>
            </div>
          ) : null}

          {mine.length === 0 ? (
            <div className="card empty">
              <p>Chưa có OKR trong lọc hiện tại. Thêm mục tiêu để bắt đầu.</p>
            </div>
          ) : (
            mine.map((o) => {
              const krs = drafts[o.id] ?? o.key_results
              return (
                <article key={o.id} className="card okr-card">
                  <div className="toolbar" style={{ marginBottom: 8 }}>
                    <div>
                      <div className="muted small mono">{o.period_label}</div>
                      <h3 style={{ margin: '4px 0' }}>{o.objective}</h3>
                    </div>
                    <span className={`status-pill ${tone(o.completeness)}`}>
                      {o.completeness_label} · {o.progress_pct}%
                    </span>
                  </div>
                  <div className="okr-progress-bar">
                    <div style={{ width: `${o.progress_pct}%` }} />
                  </div>
                  <ul className="okr-kr-list">
                    {krs.map((kr, i) => (
                      <li key={`${o.id}-${i}`}>
                        <div className="okr-kr-head">
                          <strong>{kr.kr}</strong>
                          <span className="mono">
                            {Math.round(kr.progress * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(kr.progress * 100)}
                          onChange={(e) => {
                            const progress = Number(e.target.value) / 100
                            setDrafts((d) => {
                              const next = [...(d[o.id] ?? o.key_results)]
                              next[i] = { ...next[i]!, progress }
                              return { ...d, [o.id]: next }
                            })
                          }}
                        />
                        {kr.target != null ? (
                          <div className="muted small">
                            Hiện tại {kr.current ?? '—'} / {kr.target}
                            {kr.unit ? ` ${kr.unit}` : ''}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={savingId === o.id}
                    onClick={() => void saveMine(o.id)}
                  >
                    {savingId === o.id ? 'Đang lưu…' : 'Cập nhật tiến độ'}
                  </button>
                </article>
              )
            })
          )}
        </div>
      ) : null}

      {tab === 'manager' ? (
        <div className="stack">
          <div className="grid g4">
            {[1, 2, 3, 4].map((q) => {
              const qs = summary?.quarters.find((x) => x.quarter === q)
              return (
                <button
                  key={q}
                  type="button"
                  className={`tile okr-q-tile ${activeQ === q ? 'is-active' : ''}`}
                  onClick={() => {
                    setActiveQ(q)
                    setQuarter(q)
                  }}
                >
                  <div className="v">{qs ? pct(qs.avg_progress_pct) : '—'}</div>
                  <div className="muted small">Q{q} · TB tiến độ</div>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    Đủ OKR {qs?.enough ?? 0}/{qs?.headcount ?? 0} · Thiếu{' '}
                    {qs?.missing ?? 0}
                  </div>
                </button>
              )
            })}
          </div>

          {qSummary ? (
            <div className="card">
              <div className="toolbar">
                <div>
                  <h2 style={{ margin: 0 }}>{qSummary.label} — đủ chưa?</h2>
                  <p className="muted">
                    Phủ OKR {qSummary.coverage_pct}% · Đủ cấu trúc{' '}
                    {qSummary.enough_pct}% · Hoàn thành (đạt) {qSummary.done} NV
                  </p>
                </div>
              </div>
              <div className="emp-card-grid">
                {qSummary.employees.map((emp) => (
                  <article key={emp.employee_id} className="emp-profile-card">
                    <div className="emp-profile-card__body" style={{ paddingTop: 16 }}>
                      <div className="emp-profile-card__code mono">
                        {emp.employee_code}
                      </div>
                      <h3 className="emp-profile-card__name">
                        {emp.employee_name}
                      </h3>
                      <p className="emp-profile-card__title muted">
                        {emp.department}
                      </p>
                      <div className="okr-progress-bar" style={{ marginTop: 8 }}>
                        <div style={{ width: `${emp.progress_pct}%` }} />
                      </div>
                      <div
                        className="row"
                        style={{
                          marginTop: 8,
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <span className={`status-pill ${tone(emp.completeness)}`}>
                          {emp.completeness_label}
                        </span>
                        <strong className="mono">{emp.progress_pct}%</strong>
                      </div>
                      {emp.objectives.length > 0 ? (
                        <ul className="okr-mini-list">
                          {emp.objectives.map((o) => (
                            <li key={o.id}>
                              <span className="muted small mono">
                                {o.period_label}
                              </span>
                              <div>{o.objective}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted small" style={{ marginTop: 8 }}>
                          Chưa có mục tiêu quý này — nhắc nhân viên cập nhật.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card table-card">
            <h3>Chi tiết OKR nhóm (lọc hiện tại)</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>NV</th>
                    <th>Kỳ</th>
                    <th>Mục tiêu</th>
                    <th>Tiến độ</th>
                    <th>Đủ chưa</th>
                    <th>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {team.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        Không có OKR trong lọc.
                      </td>
                    </tr>
                  ) : (
                    team.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <b>{o.employee_name}</b>
                          <div className="muted small mono">
                            {o.employee_code}
                          </div>
                        </td>
                        <td className="mono">{o.period_label}</td>
                        <td className="cell-wrap">{o.objective}</td>
                        <td className="mono">{o.progress_pct}%</td>
                        <td>
                          <span className={`status-pill ${tone(o.completeness)}`}>
                            {o.completeness_label}
                          </span>
                        </td>
                        <td className="muted small">
                          {o.updated_at.slice(0, 10)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'year' && summary ? (
        <div className="stack">
          <div className="grid g3">
            <div className="tile">
              <div className="v">{summary.year_avg_progress_pct}%</div>
              <div className="muted small">TB tiến độ cả năm {year}</div>
            </div>
            <div className="tile">
              <div className="v">{summary.headcount}</div>
              <div className="muted small">Headcount đang theo dõi</div>
            </div>
            <div className="tile">
              <div className="v">
                {Math.round(
                  summary.quarters.reduce((s, q) => s + q.coverage_pct, 0) / 4,
                )}
                %
              </div>
              <div className="muted small">Phủ OKR trung bình 4 quý</div>
            </div>
          </div>

          <div className="card table-card">
            <h2>Tổng hợp theo quý · {year}</h2>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Quý</th>
                    <th>Phủ OKR</th>
                    <th>Đủ cấu trúc</th>
                    <th>Thiếu</th>
                    <th>Mỏng (&lt;2 KR)</th>
                    <th>Đạt (≥80%)</th>
                    <th>TB tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.quarters.map((q) => (
                    <tr key={q.quarter}>
                      <td className="mono">{q.label}</td>
                      <td className="mono">
                        {q.with_okr}/{q.headcount} ({q.coverage_pct}%)
                      </td>
                      <td className="mono">
                        {q.enough}/{q.headcount} ({q.enough_pct}%)
                      </td>
                      <td className="mono">{q.missing}</td>
                      <td className="mono">{q.thin}</td>
                      <td className="mono">{q.done}</td>
                      <td className="mono">
                        <b>{q.avg_progress_pct}%</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              “Đủ cấu trúc” = có ≥2 KR (on_track / at_risk / stale / done). “Thiếu”
              = chưa có OKR trong quý.
            </p>
          </div>

          <div className="okr-year-bars">
            {summary.quarters.map((q) => (
              <div key={q.quarter} className="okr-year-bar-row">
                <span className="mono">{q.label}</span>
                <div className="okr-progress-bar">
                  <div style={{ width: `${q.avg_progress_pct}%` }} />
                </div>
                <span className="mono">{q.avg_progress_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
