import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'

type Level = { t: string; yrs?: string; req?: string[] }

type Path = {
  id: string
  name: string
  levels_json: string
}

type Assignment = {
  id: string
  employee_id: string
  employee_name: string
  employee_code: string
  department: string | null
  path_id: string
  path_name: string
  level_index: number
  levels_json: string
}

type Emp = { id: string; code: string; full_name: string }

function parseLevels(json: string): Level[] {
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    return arr.map((item) => {
      if (typeof item === 'string') return { t: item }
      if (item && typeof item === 'object' && 't' in item) {
        const o = item as Level
        return { t: o.t, yrs: o.yrs, req: o.req }
      }
      return { t: String(item) }
    })
  } catch {
    return []
  }
}

function levelsSummary(json: string): string {
  const levels = parseLevels(json)
  if (!levels.length) return '—'
  return levels.map((l) => l.t).join(' → ')
}

export function CareersPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [paths, setPaths] = useState<Path[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [emps, setEmps] = useState<Emp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pathForm, setPathForm] = useState<{
    id?: string
    name: string
    levelsText: string
  } | null>(null)
  const [assignForm, setAssignForm] = useState<{
    employee_id: string
    path_id: string
    level_index: number
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Path[] }>('/api/lists/careers'),
      fetchJson<{ items: Assignment[] }>('/api/lists/employee-careers'),
      fetchJson<{ items: Emp[] }>('/api/employees?status=active&limit=200'),
    ])
      .then(([p, a, e]) => {
        setPaths(p.items ?? [])
        setAssignments(a.items ?? [])
        setEmps(e.items ?? [])
        setError(null)
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const assignPathLevels = useMemo(() => {
    if (!assignForm?.path_id) return []
    const p = paths.find((x) => x.id === assignForm.path_id)
    return p ? parseLevels(p.levels_json) : []
  }, [assignForm?.path_id, paths])

  async function openPathEdit(p: Path) {
    setMsg(null)
    const levels = parseLevels(p.levels_json)
    setPathForm({
      id: p.id,
      name: p.name,
      levelsText: levels
        .map((l) => {
          const req = (l.req ?? []).join(', ')
          return `${l.t}|${l.yrs ?? ''}|${req}`
        })
        .join('\n'),
    })
  }

  async function savePath(e: React.FormEvent) {
    e.preventDefault()
    if (!pathForm) return
    setSaving(true)
    setMsg(null)
    const levels: Level[] = pathForm.levelsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [t, yrs, reqStr] = line.split('|').map((s) => s.trim())
        return {
          t: t || line,
          yrs: yrs || undefined,
          req: reqStr
            ? reqStr
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        }
      })
    if (!levels.length) {
      setMsg('Nhập ít nhất một bậc (mỗi dòng: Tên bậc|Kinh nghiệm|Kỹ năng)')
      setSaving(false)
      return
    }
    try {
      if (pathForm.id) {
        await fetchJson(`/api/learning/careers/${pathForm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: pathForm.name, levels }),
        })
      } else {
        await fetchJson('/api/learning/careers', {
          method: 'POST',
          body: JSON.stringify({ name: pathForm.name, levels }),
        })
      }
      setPathForm(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  async function saveAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!assignForm) return
    setSaving(true)
    setMsg(null)
    try {
      await fetchJson('/api/learning/employee-careers', {
        method: 'PUT',
        body: JSON.stringify(assignForm),
      })
      setAssignForm(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (pathForm) {
    return (
      <div className="card">
        <h2>{pathForm.id ? 'Sửa lộ trình' : 'Thêm lộ trình nghề nghiệp'}</h2>
        <p className="muted">
          Mỗi dòng một bậc: <code>Tên bậc|Kinh nghiệm|Kỹ năng 1, Kỹ năng 2</code>
        </p>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void savePath(e)}>
          <div className="form-grid">
            <label className="span2">
              Tên lộ trình *
              <input
                value={pathForm.name}
                onChange={(e) =>
                  setPathForm({ ...pathForm, name: e.target.value })
                }
                required
              />
            </label>
            <label className="span2">
              Các bậc
              <textarea
                rows={8}
                value={pathForm.levelsText}
                onChange={(e) =>
                  setPathForm({ ...pathForm, levelsText: e.target.value })
                }
                placeholder={
                  'Chuyên viên|0 – 2 năm|Giao tiếp\nChuyên viên cao cấp|3 – 5 năm|Giao tiếp, Luật lao động'
                }
                required
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setPathForm(null)}
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (assignForm) {
    return (
      <div className="card">
        <h2>Gán lộ trình cho nhân viên</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void saveAssign(e)}>
          <div className="form-grid">
            <label>
              Nhân viên *
              <select
                value={assignForm.employee_id}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, employee_id: e.target.value })
                }
                required
              >
                <option value="">—</option>
                {emps.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.code} — {emp.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lộ trình *
              <select
                value={assignForm.path_id}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    path_id: e.target.value,
                    level_index: 0,
                  })
                }
                required
              >
                <option value="">—</option>
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bậc hiện tại
              <select
                value={assignForm.level_index}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    level_index: Number(e.target.value),
                  })
                }
              >
                {assignPathLevels.length === 0 ? (
                  <option value={0}>—</option>
                ) : (
                  assignPathLevels.map((l, i) => (
                    <option key={`${l.t}-${i}`} value={i}>
                      {i + 1}. {l.t}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setAssignForm(null)}
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card empty">
        <p>Đang tải lộ trình nghề nghiệp…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Lộ trình nghề nghiệp</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="table-head">
        <p className="page-lead muted">
          Khung lộ trình theo khối và gán bậc hiện tại cho nhân viên (kỹ năng /
          thâm niên tham khảo).
          {canEdit ? ' Admin / Super Admin được chỉnh.' : ''}
        </p>
        <p className="table-meta muted">
          <strong>{paths.length}</strong> lộ trình ·{' '}
          <strong>{assignments.length}</strong> nhân viên đã gán
          {canEdit ? (
            <>
              {' · '}
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setPathForm({
                    name: '',
                    levelsText:
                      'Chuyên viên|0 – 2 năm|\nChuyên viên cao cấp|3 – 5 năm|\nTrưởng nhóm|5 năm trở lên|',
                  })
                }
              >
                + Thêm lộ trình
              </button>{' '}
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  setAssignForm({
                    employee_id: '',
                    path_id: paths[0]?.id ?? '',
                    level_index: 0,
                  })
                }
              >
                Gán nhân viên
              </button>
            </>
          ) : null}
        </p>
      </div>

      <div className="card table-card">
        <h2 style={{ margin: '0 0 12px', fontSize: '1.05rem' }}>
          Khung lộ trình
        </h2>
        {paths.length === 0 ? (
          <p className="muted">Chưa có lộ trình.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Lộ trình</th>
                  <th>Số bậc</th>
                  <th>Các bậc</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {paths.map((p) => {
                  const levels = parseLevels(p.levels_json)
                  return (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="mono">{levels.length}</td>
                      <td>{levelsSummary(p.levels_json)}</td>
                      {canEdit ? (
                        <td>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void openPathEdit(p)}
                          >
                            Sửa
                          </button>
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

      <div className="card table-card">
        <h2 style={{ margin: '0 0 12px', fontSize: '1.05rem' }}>
          Nhân viên theo lộ trình
        </h2>
        {assignments.length === 0 ? (
          <p className="muted">Chưa gán nhân viên.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Nhân viên</th>
                  <th>Phòng ban</th>
                  <th>Lộ trình</th>
                  <th>Bậc hiện tại</th>
                  <th>Bậc kế tiếp</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const levels = parseLevels(a.levels_json)
                  const cur = levels[a.level_index]
                  const next = levels[a.level_index + 1]
                  return (
                    <tr key={a.id}>
                      <td className="mono">{a.employee_code}</td>
                      <td>{a.employee_name}</td>
                      <td>{a.department ?? '—'}</td>
                      <td>{a.path_name}</td>
                      <td>
                        {cur ? (
                          <>
                            {cur.t}
                            {cur.yrs ? (
                              <div className="muted small">{cur.yrs}</div>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {next ? (
                          <>
                            {next.t}
                            {next.req?.length ? (
                              <div className="muted small">
                                Cần: {next.req.join(', ')}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <span className="status-pill good">Đỉnh lộ trình</span>
                        )}
                      </td>
                      {canEdit ? (
                        <td>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() =>
                              setAssignForm({
                                employee_id: a.employee_id,
                                path_id: a.path_id,
                                level_index: a.level_index,
                              })
                            }
                          >
                            Sửa
                          </button>
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
    </div>
  )
}
