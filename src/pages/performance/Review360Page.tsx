import { useCallback, useEffect, useMemo, useState } from 'react'
import { RadarChart } from '../../components/RadarChart'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type RoleKey = 'self' | 'mgr' | 'peer' | 'report'

type FeedbackItem = {
  id: string
  employee_id: string
  employee_code: string
  employee_name: string
  department: string
  title: string
  period: string
  competencies: string[]
  scores: Record<RoleKey, number[]>
  role_avg: Record<RoleKey, number | null>
  competency_avg: number[]
  overall: number | null
  overall_pct: number | null
  comments: Partial<Record<RoleKey, string>>
  ai_analysis: string | null
  ai_analyzed_at: string | null
  chart: {
    radar: Array<{
      label: string
      self: number | null
      mgr: number | null
      peer: number | null
      report: number | null
      avg: number
    }>
    roles: Array<{ role: RoleKey; label: string; avg: number | null }>
  }
}

type EmpOpt = { id: string; code: string; full_name: string }

const DEFAULT_COMPS = [
  'Chuyên môn',
  'Giao tiếp',
  'Làm việc nhóm',
  'Chủ động',
  'Lãnh đạo',
]

const ROLE_META: Array<{ key: RoleKey; label: string }> = [
  { key: 'self', label: 'Tự đánh giá' },
  { key: 'mgr', label: 'Quản lý' },
  { key: 'peer', label: 'Đồng nghiệp' },
  { key: 'report', label: 'Cấp dưới' },
]

function emptyScores(n: number): Record<RoleKey, number[]> {
  return {
    self: Array.from({ length: n }, () => 3.5),
    mgr: Array.from({ length: n }, () => 3.5),
    peer: Array.from({ length: n }, () => 3.5),
    report: Array.from({ length: n }, () => 3.5),
  }
}

export function Review360Page() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<EmpOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    employee_id: '',
    period: '2026-H2',
    competencies: [...DEFAULT_COMPS],
    scores: emptyScores(DEFAULT_COMPS.length),
    comments: {
      self: '',
      mgr: '',
      peer: '',
      report: '',
    } as Record<RoleKey, string>,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fb, emps] = await Promise.all([
        fetchJson<{ items: FeedbackItem[] }>('/api/feedback-360'),
        canEdit
          ? fetchJson<{ items: EmpOpt[] }>(
              '/api/employees?status=active&limit=200',
            )
          : Promise.resolve({ items: [] as EmpOpt[] }),
      ])
      setItems(fb.items)
      setEmployees(emps.items)
      setSelectedId((cur) => cur ?? fb.items[0]?.id ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được 360')
    } finally {
      setLoading(false)
    }
  }, [canEdit])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) ?? null,
    [items, selectedId],
  )

  const periods = useMemo(
    () => [...new Set(items.map((i) => i.period))],
    [items],
  )

  async function runAi() {
    if (!selected) return
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetchJson<{
        ok: boolean
        analysis?: string
        analyzed_at?: string
        model?: string
        gateway_id?: string
        error?: string
      }>(`/api/feedback-360/${selected.id}/analyze`, { method: 'POST' })
      if (!res.ok) throw new Error(res.error || 'AI không phản hồi')
      setItems((list) =>
        list.map((it) =>
          it.id === selected.id
            ? {
                ...it,
                ai_analysis: res.analysis ?? it.ai_analysis,
                ai_analyzed_at: res.analyzed_at ?? it.ai_analyzed_at,
              }
            : it,
        ),
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Phân tích thất bại')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveForm() {
    setSaving(true)
    setError(null)
    try {
      const scores = canEdit
        ? form.scores
        : { self: form.scores.self }
      const comments = canEdit
        ? form.comments
        : { self: form.comments.self }
      const payload = {
        employee_id: canEdit
          ? form.employee_id || user?.employeeId
          : user?.employeeId,
        period: form.period,
        competencies: form.competencies,
        scores,
        comments,
      }
      if (!payload.employee_id) throw new Error('Chọn nhân viên')
      const res = await fetchJson<{ id: string }>('/api/feedback-360', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setFormOpen(false)
      await load()
      setSelectedId(res.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không lưu được đánh giá')
    } finally {
      setSaving(false)
    }
  }

  function setScore(role: RoleKey, idx: number, value: number) {
    setForm((f) => {
      const next = { ...f.scores, [role]: [...f.scores[role]] }
      next[role][idx] = value
      return { ...f, scores: next }
    })
  }

  if (loading && items.length === 0) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải đánh giá 360…</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="page-lead muted">
        Đánh giá đa chiều — radar năng lực, nhận xét và phân tích bằng AI.
      </p>

      {error ? <p className="warn-text">{error}</p> : null}

      <div className="toolbar filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn ghost`}
              onClick={() => {
                const first = items.find((i) => i.period === p)
                if (first) setSelectedId(first.id)
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="sp" style={{ flex: 1 }} />
        {(canEdit || user?.employeeId) && (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setFormOpen((v) => !v)
              if (!form.employee_id && user?.employeeId) {
                setForm((f) => ({ ...f, employee_id: user.employeeId! }))
              }
            }}
          >
            {formOpen ? 'Đóng form' : '+ Chèn đánh giá'}
          </button>
        )}
      </div>

      {formOpen ? (
        <div className="card">
          <h2>Chèn / cập nhật đánh giá 360</h2>
          <div className="form-grid">
            {canEdit ? (
              <label>
                Nhân viên
                <select
                  value={form.employee_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, employee_id: e.target.value }))
                  }
                  required
                >
                  <option value="">— Chọn —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.code} · {e.full_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Kỳ
              <input
                value={form.period}
                onChange={(e) =>
                  setForm((f) => ({ ...f, period: e.target.value }))
                }
                placeholder="2026-H2"
              />
            </label>
          </div>

          <h3 style={{ marginTop: 16 }}>Điểm theo năng lực (1–5)</h3>
          {!canEdit ? (
            <p className="muted small">
              Nhân viên chỉ gửi điểm tự đánh giá (self); các chiều khác do HR
              nhập.
            </p>
          ) : null}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Năng lực</th>
                  {(canEdit ? ROLE_META : ROLE_META.filter((r) => r.key === 'self')).map(
                    (r) => (
                      <th key={r.key}>{r.label}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {form.competencies.map((comp, i) => (
                  <tr key={comp}>
                    <td>{comp}</td>
                    {(canEdit
                      ? ROLE_META
                      : ROLE_META.filter((r) => r.key === 'self')
                    ).map((r) => (
                      <td key={r.key}>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          step={0.1}
                          value={form.scores[r.key][i] ?? 3}
                          onChange={(e) =>
                            setScore(r.key, i, Number(e.target.value))
                          }
                          style={{ width: 72 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 16 }}>Nhận xét</h3>
          <div className="form-grid">
            {(canEdit
              ? ROLE_META
              : ROLE_META.filter((r) => r.key === 'self')
            ).map((r) => (
              <label key={r.key} className="span2">
                {r.label}
                <textarea
                  rows={2}
                  value={form.comments[r.key]}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      comments: { ...f.comments, [r.key]: e.target.value },
                    }))
                  }
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            className="btn primary"
            style={{ marginTop: 12 }}
            disabled={saving}
            onClick={() => void saveForm()}
          >
            {saving ? 'Đang lưu…' : 'Lưu đánh giá'}
          </button>
        </div>
      ) : null}

      <div className="f360-layout">
        <aside className="card f360-list">
          <h3>Hồ sơ 360</h3>
          <ul className="f360-nav">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  className={it.id === selectedId ? 'is-active' : ''}
                  onClick={() => setSelectedId(it.id)}
                >
                  <strong>{it.employee_name}</strong>
                  <span className="muted small">
                    {it.period} · {it.overall?.toFixed(1) ?? '—'}/5
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {selected ? (
          <div className="stack f360-main">
            <div className="card">
              <div className="toolbar">
                <div>
                  <div className="muted small mono">{selected.period}</div>
                  <h2 style={{ margin: '4px 0' }}>{selected.employee_name}</h2>
                  <p className="muted">
                    {selected.employee_code} · {selected.title} ·{' '}
                    {selected.department}
                  </p>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <div className="tile" style={{ minWidth: 100, padding: 12 }}>
                    <div className="v" style={{ fontSize: 22 }}>
                      {selected.overall?.toFixed(2) ?? '—'}
                    </div>
                    <div className="muted small">TB /5</div>
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={analyzing}
                    onClick={() => void runAi()}
                  >
                    {analyzing ? 'Đang phân tích…' : 'Phân tích bằng AI'}
                  </button>
                </div>
              </div>

              <div className="grid g2" style={{ marginTop: 8 }}>
                <div>
                  <h3>Radar năng lực</h3>
                  <RadarChart
                    labels={selected.competencies}
                    series={[
                      {
                        key: 'self',
                        label: 'Tự đánh giá',
                        values: selected.scores.self,
                      },
                      {
                        key: 'mgr',
                        label: 'Quản lý',
                        values: selected.scores.mgr,
                      },
                      {
                        key: 'peer',
                        label: 'Đồng nghiệp',
                        values: selected.scores.peer,
                      },
                      {
                        key: 'report',
                        label: 'Cấp dưới',
                        values: selected.scores.report,
                      },
                    ]}
                  />
                </div>
                <div>
                  <h3>Trung bình theo chiều</h3>
                  <div className="vbar" style={{ minHeight: 220 }}>
                    <div className="vbar-plot">
                      {selected.chart.roles.map((r) => {
                        const v = r.avg ?? 0
                        const pct = (v / 5) * 100
                        return (
                          <div key={r.role} className="vbar-col">
                            <div className="vbar-val">
                              {r.avg == null ? '—' : r.avg.toFixed(2)}
                            </div>
                            <div className="vbar-track">
                              <div
                                className="vbar-fill"
                                style={{
                                  height: `${Math.max(pct, r.avg ? 4 : 0)}%`,
                                }}
                              />
                            </div>
                            <div className="vbar-label">{r.label}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <h3 style={{ marginTop: 16 }}>Theo năng lực</h3>
                  <div className="f360-comp-bars">
                    {selected.chart.radar.map((r) => (
                      <div key={r.label} className="f360-comp-row">
                        <span>{r.label}</span>
                        <div className="okr-progress-bar">
                          <div style={{ width: `${(r.avg / 5) * 100}%` }} />
                        </div>
                        <span className="mono">{r.avg.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3>Nhận xét</h3>
              <div className="grid g2">
                {ROLE_META.map((r) => (
                  <div key={r.key}>
                    <strong>{r.label}</strong>
                    <p className="muted">
                      {selected.comments[r.key] || 'Chưa có nhận xét.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card f360-ai">
              <div className="toolbar">
                <h3 style={{ margin: 0 }}>Phân tích</h3>
                {selected.ai_analyzed_at ? (
                  <span className="muted small">
                    Lúc {selected.ai_analyzed_at.slice(0, 19).replace('T', ' ')}
                  </span>
                ) : null}
              </div>
              {selected.ai_analysis ? (
                <pre className="f360-ai-body">{selected.ai_analysis}</pre>
              ) : (
                <p className="muted">
                  Chưa có phân tích. Bấm &quot;Phân tích bằng AI&quot; để hệ thống
                  ra kết quả
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="card empty">
            <p>Chọn một hồ sơ 360 ở cột trái.</p>
          </div>
        )}
      </div>
    </div>
  )
}
