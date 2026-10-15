import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { enrollmentStatus, progressPercent } from '../../lib/learning'

type Enrollment = {
  id: string
  employee_id: string
  course_id: string
  employee_name: string
  employee_code: string
  course_title: string
  course_mandatory?: number
  progress: number
  score: number | null
  due_on: string | null
  enrolled_on: string | null
  completed_on: string | null
}

type Emp = { id: string; code: string; full_name: string }
type CourseOpt = { id: string; title: string; code: string | null }

type Form = {
  id?: string
  employee_id: string
  course_id: string
  progress: number
  score: string
  due_on: string
  enrolled_on: string
  completed_on: string
}

export function ProgressPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Enrollment[]>([])
  const [emps, setEmps] = useState<Emp[]>([])
  const [courses, setCourses] = useState<CourseOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ items: Enrollment[] }>('/api/lists/enrollments'),
      fetchJson<{ items: Emp[] }>('/api/employees?status=active&limit=200'),
      fetchJson<{ items: CourseOpt[] }>('/api/lists/courses'),
    ])
      .then(([en, e, c]) => {
        setItems(en.items ?? [])
        setEmps(e.items ?? [])
        setCourses(c.items ?? [])
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

  async function openEdit(row: Enrollment) {
    setMsg(null)
    const res = await fetchJson<{ enrollment: Enrollment }>(
      `/api/learning/enrollments/${row.id}`,
    )
    const en = res.enrollment
    setForm({
      id: en.id,
      employee_id: en.employee_id,
      course_id: en.course_id,
      progress: progressPercent(en.progress),
      score: en.score != null ? String(en.score) : '',
      due_on: en.due_on ?? '',
      enrolled_on: en.enrolled_on ?? '',
      completed_on: en.completed_on ?? '',
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setMsg(null)
    const payload = {
      employee_id: form.employee_id,
      course_id: form.course_id,
      progress: Number(form.progress) || 0,
      score: form.score === '' ? null : Number(form.score),
      due_on: form.due_on || null,
      enrolled_on: form.enrolled_on || null,
      completed_on: form.completed_on || null,
    }
    try {
      if (form.id) {
        await fetchJson(`/api/learning/enrollments/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson('/api/learning/enrollments', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setForm(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  if (form) {
    return (
      <div className="card">
        <h2>{form.id ? 'Cập nhật tiến độ học' : 'Ghi danh học viên'}</h2>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <div className="form-grid">
            {!form.id ? (
              <>
                <label>
                  Nhân viên *
                  <select
                    value={form.employee_id}
                    onChange={(e) =>
                      setForm({ ...form, employee_id: e.target.value })
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
                  Khóa học *
                  <select
                    value={form.course_id}
                    onChange={(e) =>
                      setForm({ ...form, course_id: e.target.value })
                    }
                    required
                  >
                    <option value="">—</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code} — ` : ''}
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <label>
              Tiến độ (%)
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                value={form.progress}
                onChange={(e) =>
                  setForm({ ...form, progress: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Điểm (nếu có)
              <input
                type="number"
                min={0}
                max={100}
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                placeholder="—"
              />
            </label>
            <label>
              Ngày ghi danh
              <input
                type="date"
                value={form.enrolled_on}
                onChange={(e) =>
                  setForm({ ...form, enrolled_on: e.target.value })
                }
              />
            </label>
            <label>
              Hạn hoàn thành
              <input
                type="date"
                value={form.due_on}
                onChange={(e) => setForm({ ...form, due_on: e.target.value })}
              />
            </label>
            <label>
              Ngày hoàn thành
              <input
                type="date"
                value={form.completed_on}
                onChange={(e) =>
                  setForm({ ...form, completed_on: e.target.value })
                }
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
              onClick={() => setForm(null)}
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
        <p>Đang tải tiến độ học…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Tiến độ học</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="table-head">
        <p className="page-lead muted">
          Theo dõi ghi danh, tiến độ %, điểm và hạn hoàn thành.
          {canEdit ? ' Admin / Super Admin được ghi danh và cập nhật.' : ''}
        </p>
        <p className="table-meta muted">
          <strong>{items.length}</strong> bản ghi
          {canEdit ? (
            <>
              {' · '}
              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  setForm({
                    employee_id: '',
                    course_id: '',
                    progress: 0,
                    score: '',
                    due_on: '',
                    enrolled_on: new Date().toISOString().slice(0, 10),
                    completed_on: '',
                  })
                }
              >
                + Ghi danh
              </button>
            </>
          ) : null}
        </p>
      </div>
      {items.length === 0 ? (
        <div className="card empty">
          <p>Không có dữ liệu</p>
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Mã NV</th>
                  <th>Nhân viên</th>
                  <th>Khóa học</th>
                  <th>Tiến độ</th>
                  <th>Trạng thái</th>
                  <th>Điểm</th>
                  <th>Ghi danh</th>
                  <th>Hoàn thành</th>
                  <th>Hạn</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const pct = progressPercent(r.progress)
                  const st = enrollmentStatus(pct, r.due_on)
                  return (
                    <tr key={r.id}>
                      <td className="mono">{r.employee_code}</td>
                      <td>{r.employee_name}</td>
                      <td>
                        {r.course_title}
                        {r.course_mandatory ? (
                          <>
                            {' '}
                            <span className="status-pill bad">Bắt buộc</span>
                          </>
                        ) : null}
                      </td>
                      <td className="mono">{pct}%</td>
                      <td>
                        <span className={`status-pill ${st.tone}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="mono">
                        {r.score != null ? r.score : '—'}
                      </td>
                      <td className="mono">{r.enrolled_on ?? '—'}</td>
                      <td className="mono">{r.completed_on ?? '—'}</td>
                      <td className="mono">{r.due_on ?? '—'}</td>
                      {canEdit ? (
                        <td>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void openEdit(r)}
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
        </div>
      )}
    </div>
  )
}
