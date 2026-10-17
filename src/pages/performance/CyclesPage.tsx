import { useCallback, useEffect, useMemo, useState } from 'react'
import { clearApiCache, fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { fd } from '../../lib/format'
import { CYCLE_STATUS, labelOf } from '../../lib/labels'

type Cycle = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: string
  status_label?: string
  completed_count: number
  total_count: number
  progress_pct: number
}

type Rating = {
  id: string | null
  employee_id: string
  employee_code: string
  employee_name: string
  department: string | null
  title: string | null
  self_score: number | null
  manager_score: number | null
  final_score: number | null
}

type DraftScores = {
  self_score: string
  manager_score: string
  final_score: string
}

function statusTone(status: string): string {
  if (status === 'open') return 'good'
  if (status === 'planned') return 'info'
  if (status === 'closed') return ''
  return 'warn'
}

function parseScore(raw: string): number | null | undefined {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t.replace(',', '.'))
  if (Number.isNaN(n)) return undefined
  return n
}

function scoreInput(value: number | null | undefined): string {
  if (value == null) return ''
  return String(value)
}

export function CyclesPage() {
  const { user } = useAuth()
  const canManage = !!user?.canEditData
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [drafts, setDrafts] = useState<Record<string, DraftScores>>({})
  const [loading, setLoading] = useState(true)
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
  })

  const selected = useMemo(
    () => cycles.find((c) => c.id === selectedId) ?? null,
    [cycles, selectedId],
  )

  const loadCycles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      clearApiCache('/api/cycles')
      clearApiCache('/api/lists/cycles')
      const res = await fetchJson<{ items: Cycle[] }>('/api/cycles', {
        cache: 'no-store',
      })
      const items = res.items ?? []
      setCycles(items)
      setSelectedId((cur) => {
        if (cur && items.some((c) => c.id === cur)) return cur
        return items[0]?.id ?? null
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được chu kỳ')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRatings = useCallback(async (cycleId: string) => {
    setRatingsLoading(true)
    setError(null)
    try {
      const res = await fetchJson<{ cycle: Cycle; items: Rating[] }>(
        `/api/cycles/${cycleId}/ratings`,
        { cache: 'no-store' },
      )
      setRatings(res.items ?? [])
      const next: Record<string, DraftScores> = {}
      for (const r of res.items ?? []) {
        next[r.employee_id] = {
          self_score: scoreInput(r.self_score),
          manager_score: scoreInput(r.manager_score),
          final_score: scoreInput(r.final_score),
        }
      }
      setDrafts(next)
      if (res.cycle) {
        setCycles((list) =>
          list.map((c) => (c.id === res.cycle.id ? { ...c, ...res.cycle } : c)),
        )
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không tải được kết quả')
      setRatings([])
    } finally {
      setRatingsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCycles()
  }, [loadCycles])

  useEffect(() => {
    if (!selectedId) {
      setRatings([])
      return
    }
    void loadRatings(selectedId)
  }, [selectedId, loadRatings])

  async function openCycle(cycleId: string) {
    setBusy(`open:${cycleId}`)
    setMsg(null)
    setError(null)
    try {
      await fetchJson(`/api/cycles/${cycleId}/open`, { method: 'POST' })
      setMsg('Đã mở chu kỳ đánh giá')
      await loadCycles()
      await loadRatings(cycleId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không mở được chu kỳ')
    } finally {
      setBusy(null)
    }
  }

  async function closeCycle(cycleId: string) {
    setBusy(`close:${cycleId}`)
    setMsg(null)
    setError(null)
    try {
      await fetchJson(`/api/cycles/${cycleId}/close`, { method: 'POST' })
      setMsg('Đã đóng chu kỳ đánh giá')
      await loadCycles()
      await loadRatings(cycleId)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Không đóng được chu kỳ')
    } finally {
      setBusy(null)
    }
  }

  async function createCycle(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    setBusy('create')
    setMsg(null)
    setError(null)
    try {
      const res = await fetchJson<{ cycle: Cycle }>('/api/cycles', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name.trim(),
          start_date: createForm.start_date,
          end_date: createForm.end_date,
        }),
      })
      setCreateForm({ name: '', start_date: '', end_date: '' })
      setMsg('Đã tạo chu kỳ mới')
      await loadCycles()
      if (res.cycle?.id) setSelectedId(res.cycle.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tạo được chu kỳ')
    } finally {
      setBusy(null)
    }
  }

  function canEditSelf(employeeId: string): boolean {
    if (!selected || selected.status !== 'open') return false
    if (canManage) return true
    return !!user?.employeeId && user.employeeId === employeeId
  }

  function canEditManager(employeeId: string): boolean {
    if (!selected || selected.status !== 'open') return false
    if (canManage) return true
    // Direct managers see reports in the scoped list (not themselves).
    return !!user?.employeeId && user.employeeId !== employeeId
  }

  async function saveRating(employeeId: string) {
    if (!selected || selected.status !== 'open') return
    const draft = drafts[employeeId]
    if (!draft) return

    const self = parseScore(draft.self_score)
    const mgr = parseScore(draft.manager_score)
    const fin = parseScore(draft.final_score)
    if (self === undefined || mgr === undefined || fin === undefined) {
      setError('Điểm phải là số từ 0 đến 5')
      return
    }

    const payload: Record<string, unknown> = { employee_id: employeeId }
    if (canEditSelf(employeeId)) payload.self_score = self
    if (canEditManager(employeeId)) {
      payload.manager_score = mgr
      payload.final_score = fin
    }

    setBusy(`save:${employeeId}`)
    setError(null)
    setMsg(null)
    try {
      await fetchJson(`/api/cycles/${selected.id}/ratings`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setMsg('Đã lưu điểm')
      await loadRatings(selected.id)
      await loadCycles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được điểm')
    } finally {
      setBusy(null)
    }
  }

  if (loading && cycles.length === 0) {
    return (
      <div className="stack">
        <p className="page-lead muted">Đang tải chu kỳ đánh giá…</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="page-lead muted">
        Quản lý chu kỳ đánh giá hiệu suất — mở kỳ, nhập điểm tự đánh giá / quản
        lý và theo dõi tiến độ hoàn tất.
      </p>

      {error ? <p className="warn-text">{error}</p> : null}
      {msg ? (
        <p className="muted" style={{ color: 'var(--good)' }}>
          {msg}
        </p>
      ) : null}

      <div className="cycle-strip" role="list">
        {cycles.length === 0 ? (
          <div className="card empty">
            <p>Chưa có chu kỳ đánh giá. Tạo chu kỳ mới bên dưới.</p>
          </div>
        ) : (
          cycles.map((c) => {
            const active = c.id === selectedId
            const label = c.status_label || labelOf(CYCLE_STATUS, c.status)
            return (
              <div
                key={c.id}
                role="listitem"
                className={`cycle-card ${active ? 'selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    setSelectedId(c.id)
                  }
                }}
                tabIndex={0}
              >
                <div className="cycle-card__top">
                  <strong className="cycle-card__name">{c.name}</strong>
                  <span className={`status-pill ${statusTone(c.status)}`}>
                    {label}
                  </span>
                </div>
                <div className="cycle-card__dates muted">
                  {fd(c.start_date)} – {fd(c.end_date)}
                </div>

                {c.status === 'planned' ? (
                  canManage ? (
                    <div className="cycle-card__actions">
                      <button
                        type="button"
                        className="btn primary"
                        disabled={busy === `open:${c.id}`}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          void openCycle(c.id)
                        }}
                      >
                        {busy === `open:${c.id}` ? 'Đang mở…' : 'Mở chu kỳ'}
                      </button>
                    </div>
                  ) : (
                    <p className="cycle-card__hint muted">
                      Chờ HR mở chu kỳ để bắt đầu đánh giá.
                    </p>
                  )
                ) : (
                  <>
                    <div
                      className="okr-progress-bar"
                      aria-label={`${c.progress_pct}% hoàn tất`}
                    >
                      <div style={{ width: `${c.progress_pct}%` }} />
                    </div>
                    <div className="cycle-card__meta muted">
                      {c.completed_count} đánh giá hoàn tất
                      {c.total_count > 0 ? ` / ${c.total_count}` : ''}
                    </div>
                    {c.status === 'open' && canManage ? (
                      <div className="cycle-card__actions">
                        <button
                          type="button"
                          className="btn ghost"
                          disabled={busy === `close:${c.id}`}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            void closeCycle(c.id)
                          }}
                        >
                          {busy === `close:${c.id}`
                            ? 'Đang đóng…'
                            : 'Đóng chu kỳ'}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="card">
        <h2>Kết quả: {selected?.name ?? '—'}</h2>
        {!selected ? (
          <p className="empty">Chọn một chu kỳ để xem kết quả.</p>
        ) : selected.status === 'planned' ? (
          <div className="cycle-empty">
            <p>
              Chu kỳ chưa mở. Mở chu kỳ để bắt đầu nhập điểm tự đánh giá và điểm
              quản lý.
            </p>
          </div>
        ) : ratingsLoading ? (
          <p className="muted">Đang tải kết quả…</p>
        ) : ratings.length === 0 ? (
          <p className="empty">Chưa có đánh giá trong chu kỳ này.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nhân viên</th>
                  <th>Phòng</th>
                  <th>Tự ĐG</th>
                  <th>QL</th>
                  <th>Cuối</th>
                  {selected.status === 'open' ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {ratings.map((r) => {
                  const draft = drafts[r.employee_id] ?? {
                    self_score: '',
                    manager_score: '',
                    final_score: '',
                  }
                  const editableSelf = canEditSelf(r.employee_id)
                  const editableMgr = canEditManager(r.employee_id)
                  const showEdit =
                    selected.status === 'open' && (editableSelf || editableMgr)
                  return (
                    <tr key={r.employee_id}>
                      <td className="mono">{r.employee_code}</td>
                      <td>{r.employee_name}</td>
                      <td className="muted">{r.department ?? '—'}</td>
                      <td>
                        {showEdit && editableSelf ? (
                          <input
                            className="score-input"
                            type="number"
                            min={0}
                            max={5}
                            step={0.1}
                            value={draft.self_score}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [r.employee_id]: {
                                  ...draft,
                                  self_score: e.target.value,
                                },
                              }))
                            }
                          />
                        ) : (
                          <span className="mono">{r.self_score ?? '—'}</span>
                        )}
                      </td>
                      <td>
                        {showEdit && editableMgr ? (
                          <input
                            className="score-input"
                            type="number"
                            min={0}
                            max={5}
                            step={0.1}
                            value={draft.manager_score}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [r.employee_id]: {
                                  ...draft,
                                  manager_score: e.target.value,
                                },
                              }))
                            }
                          />
                        ) : (
                          <span className="mono">
                            {r.manager_score ?? '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        {showEdit && editableMgr ? (
                          <input
                            className="score-input"
                            type="number"
                            min={0}
                            max={5}
                            step={0.1}
                            value={draft.final_score}
                            onChange={(e) =>
                              setDrafts((d) => ({
                                ...d,
                                [r.employee_id]: {
                                  ...draft,
                                  final_score: e.target.value,
                                },
                              }))
                            }
                            placeholder="TB"
                          />
                        ) : (
                          <span className="mono">{r.final_score ?? '—'}</span>
                        )}
                      </td>
                      {selected.status === 'open' ? (
                        <td>
                          {showEdit ? (
                            <button
                              type="button"
                              className="btn primary"
                              disabled={busy === `save:${r.employee_id}`}
                              onClick={() => void saveRating(r.employee_id)}
                            >
                              {busy === `save:${r.employee_id}`
                                ? 'Lưu…'
                                : 'Lưu'}
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canManage ? (
        <div className="card">
          <h2>Tạo chu kỳ mới</h2>
          <form className="form-grid" onSubmit={(e) => void createCycle(e)}>
            <label>
              Tên chu kỳ
              <input
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Ví dụ: Đánh giá quý 1/2027"
                required
                maxLength={200}
              />
            </label>
            <label>
              Bắt đầu
              <input
                type="date"
                value={createForm.start_date}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, start_date: e.target.value }))
                }
                required
              />
            </label>
            <label>
              Kết thúc
              <input
                type="date"
                value={createForm.end_date}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, end_date: e.target.value }))
                }
                required
              />
            </label>
            <div className="form-actions">
              <button
                type="submit"
                className="btn primary"
                disabled={busy === 'create'}
              >
                {busy === 'create' ? 'Đang tạo…' : 'Tạo chu kỳ'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
