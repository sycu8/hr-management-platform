import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { DEPARTMENTS } from '../../lib/hr-options'
import {
  defaultOnboardingTasks,
  daysUntil,
  formatJoinDate,
  parseTasks,
  taskLabel,
  type OnboardingTask,
} from '../../lib/onboarding'

type Plan = {
  id: string
  full_name: string
  role_title: string | null
  department: string | null
  start_date: string
  probation_end: string | null
  status: string
  notes: string | null
  tasks_json?: string
  requirements_json?: string
  remind_convert?: boolean
  employee_id?: string | null
  candidate_id?: string | null
  tasks?: OnboardingTask[]
  requirements?: string[]
}

function addMonths(iso: string, m: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setMonth(d.getMonth() + m)
  return d.toISOString().slice(0, 10)
}

function planTasks(p: Plan): OnboardingTask[] {
  if (p.tasks && p.tasks.length) return p.tasks
  return parseTasks(p.tasks_json)
}

export function OnboardingPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<
    (Partial<Plan> & { tasksText?: string; reqText?: string }) | null
  >(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchJson<{ items: Plan[] }>('/api/lists/onboarding')
      .then((r) => {
        setItems(r.items ?? [])
        setError(null)
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Không tải được'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openEdit(id: string) {
    setMsg(null)
    setEditId(id)
    const res = await fetchJson<{ plan: Plan }>(
      `/api/recruitment/onboarding/${id}`,
    )
    const p = res.plan
    const tasks = (p.tasks as OnboardingTask[]) ?? []
    const reqs = (p.requirements as string[]) ?? []
    setEditing({
      ...p,
      tasksText: tasks
        .map((t) => `${t.done ? '[x]' : '[ ]'} ${taskLabel(t)}`)
        .join('\n'),
      reqText: reqs.join('\n'),
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setMsg(null)
    const tasks = (editing.tasksText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const done = /^\[x\]/i.test(line)
        const t = line.replace(/^\[(x| )\]\s*/i, '').trim()
        return { t, done }
      })
    const requirements = (editing.reqText ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const start = editing.start_date!
    const payload = {
      full_name: editing.full_name,
      role_title: editing.role_title,
      department: editing.department,
      start_date: start,
      probation_end:
        editing.probation_end || (start ? addMonths(start, 3) : null),
      status: editing.status,
      notes: editing.notes,
      tasks,
      requirements,
    }
    try {
      if (editId) {
        await fetchJson(`/api/recruitment/onboarding/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      } else {
        await fetchJson('/api/recruitment/onboarding', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      setEditing(null)
      setEditId(null)
      load()
    } catch (ex: unknown) {
      setMsg(ex instanceof Error ? ex.message : 'Không lưu được')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(plan: Plan, index: number) {
    if (!canEdit) return
    const tasks = planTasks(plan).map((t, i) => ({
      t: taskLabel(t) || `Việc ${i + 1}`,
      done: i === index ? !t.done : Boolean(t.done),
    }))
    const key = `${plan.id}:${index}`
    setToggling(key)
    // Optimistic update
    setItems((prev) =>
      prev.map((p) => (p.id === plan.id ? { ...p, tasks } : p)),
    )
    try {
      await fetchJson(`/api/recruitment/onboarding/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tasks }),
      })
    } catch {
      load()
    } finally {
      setToggling(null)
    }
  }

  async function markConvert(id: string, converted: boolean) {
    await fetchJson(`/api/recruitment/onboarding/${id}/mark-convert`, {
      method: 'POST',
      body: JSON.stringify({ converted }),
    })
    load()
  }

  if (editing) {
    return (
      <div className="card">
        <h2>{editId ? 'Sửa onboarding' : 'Thêm kế hoạch onboarding'}</h2>
        <p className="muted">
          Sau 3 tháng thử việc hệ thống nhắc chuyển thành hồ sơ nhân viên chính
          thức.
        </p>
        {msg ? <p className="warn-text">{msg}</p> : null}
        <form className="hr-form" onSubmit={(e) => void save(e)}>
          <div className="form-grid">
            <label>
              Họ tên *
              <input
                value={editing.full_name ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, full_name: e.target.value })
                }
                required
              />
            </label>
            <label>
              Vị trí
              <input
                value={editing.role_title ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, role_title: e.target.value })
                }
              />
            </label>
            <label>
              Phòng ban
              <select
                value={editing.department ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, department: e.target.value })
                }
              >
                <option value="">—</option>
                {[...DEPARTMENTS].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ngày bắt đầu *
              <input
                type="date"
                value={editing.start_date ?? ''}
                onChange={(e) => {
                  const start_date = e.target.value
                  setEditing({
                    ...editing,
                    start_date,
                    probation_end: start_date
                      ? addMonths(start_date, 3)
                      : editing.probation_end,
                  })
                }}
                required
              />
            </label>
            <label>
              Hết hạn thử việc (mặc định +3 tháng)
              <input
                type="date"
                value={editing.probation_end ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, probation_end: e.target.value })
                }
              />
            </label>
            <label>
              Trạng thái
              <select
                value={editing.status ?? 'in_progress'}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                <option value="in_progress">Đang onboard</option>
                <option value="due_convert">Cần chuyển chính thức</option>
                <option value="converted">Đã chuyển hồ sơ NV</option>
                <option value="cancelled">Hủy</option>
              </select>
            </label>
            <label className="span2">
              Checklist onboarding ([x] = hoàn thành)
              <textarea
                rows={8}
                value={editing.tasksText ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, tasksText: e.target.value })
                }
              />
            </label>
            <label className="span2">
              Yêu cầu trước khi chuyển chính thức
              <textarea
                rows={3}
                value={editing.reqText ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, reqText: e.target.value })
                }
              />
            </label>
            <label className="span2">
              Ghi chú HR
              <textarea
                rows={2}
                value={editing.notes ?? ''}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
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
              onClick={() => {
                setEditing(null)
                setEditId(null)
              }}
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
      <div className="onboarding-page">
        <header className="onboarding-page__head">
          <h2>Onboarding</h2>
          <p className="muted">Đang tải…</p>
        </header>
      </div>
    )
  }
  if (error) {
    return (
      <div className="onboarding-page">
        <header className="onboarding-page__head">
          <h2>Onboarding</h2>
          <p className="warn-text">{error}</p>
        </header>
      </div>
    )
  }

  const active = items.filter((p) => p.status !== 'cancelled')
  const cards = active.filter((p) => p.status !== 'converted')
  const converted = active.filter((p) => p.status === 'converted')

  return (
    <div className="onboarding-page">
      <header className="onboarding-page__head">
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div>
            <h2>Onboarding</h2>
            <p className="muted onboarding-page__lead">
              Danh sách việc cho nhân viên mới. Khi ứng viên chuyển sang bước
              Nhận việc, hệ thống tự tạo danh sách.
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const start = new Date().toISOString().slice(0, 10)
                const tasks = defaultOnboardingTasks()
                setEditId(null)
                setEditing({
                  full_name: '',
                  role_title: '',
                  department: 'Kỹ thuật',
                  start_date: start,
                  probation_end: addMonths(start, 3),
                  status: 'in_progress',
                  tasksText: tasks
                    .map((t) => `[ ] ${t.t}`)
                    .join('\n'),
                  reqText: [
                    'Hoàn tất checklist onboarding',
                    'Đánh giá thử việc từ QL trực tiếp',
                    'Chuyển HĐ chính thức sau 3 tháng',
                  ].join('\n'),
                })
              }}
            >
              + Thêm onboarding
            </button>
          ) : null}
        </div>
      </header>

      {cards.length === 0 ? (
        <div className="card empty">
          <p>Chưa có nhân viên mới cần onboarding.</p>
        </div>
      ) : (
        <div className="grid g2 onboarding-grid">
          {cards.map((p) => {
            const tasks = planTasks(p)
            const done = tasks.filter((t) => t.done).length
            const total = tasks.length || 1
            const pct = Math.round((done / total) * 100)
            const days = daysUntil(p.start_date)
            const due = p.remind_convert || p.status === 'due_convert'
            const meta = [
              p.role_title || '—',
              p.department || '—',
              `nhận việc ${formatJoinDate(p.start_date)}`,
            ].join(' · ')

            return (
              <article
                key={p.id}
                className={`card onboarding-card${due ? ' onboarding-card--due' : ''}`}
              >
                <div className="onboarding-card__top">
                  <div className="onboarding-card__identity">
                    <h3 className="onboarding-card__name">{p.full_name}</h3>
                    <p className="muted small onboarding-card__meta">
                      {meta}
                      {days > 0 ? (
                        <span className="onboarding-card__remain">
                          {' '}
                          (còn {days} ngày)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={`onboarding-card__badge${pct === 100 ? ' is-done' : ''}`}
                    aria-label={`${done} trên ${total} việc hoàn thành`}
                  >
                    {done}/{total}
                  </span>
                </div>

                <div
                  className="onboarding-card__bar"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <i style={{ width: `${pct}%` }} />
                </div>

                <ul className="onboarding-checklist">
                  {tasks.map((t, i) => {
                    const label = taskLabel(t) || `Việc ${i + 1}`
                    const busy = toggling === `${p.id}:${i}`
                    return (
                      <li key={`${p.id}-${i}`}>
                        <label
                          className={`onboarding-check${t.done ? ' is-done' : ''}${!canEdit ? ' is-readonly' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(t.done)}
                            disabled={!canEdit || busy}
                            onChange={() => void toggleTask(p, i)}
                          />
                          <span className="onboarding-check__box" aria-hidden />
                          <span className="onboarding-check__label">{label}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>

                {canEdit ? (
                  <div className="onboarding-card__actions">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void openEdit(p.id)}
                    >
                      Sửa
                    </button>
                    {due && p.status !== 'converted' ? (
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => void markConvert(p.id, true)}
                      >
                        Đã chuyển NV
                      </button>
                    ) : null}
                    {!due && p.status === 'in_progress' ? (
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => void markConvert(p.id, false)}
                      >
                        Nhắc convert
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {converted.length > 0 ? (
        <details className="onboarding-converted">
          <summary className="muted small">
            Đã chuyển hồ sơ NV ({converted.length})
          </summary>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Vị trí</th>
                  <th>Bắt đầu</th>
                  <th>Hết TV</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {converted.map((p) => (
                  <tr key={p.id}>
                    <td>{p.full_name}</td>
                    <td>{p.role_title ?? '—'}</td>
                    <td>{formatJoinDate(p.start_date)}</td>
                    <td>
                      {p.probation_end
                        ? formatJoinDate(p.probation_end)
                        : '—'}
                    </td>
                    {canEdit ? (
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => void openEdit(p.id)}
                        >
                          Sửa
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  )
}
