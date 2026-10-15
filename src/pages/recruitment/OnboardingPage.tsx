import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { DEPARTMENTS } from '../../lib/hr-options'

type Task = { t?: string; title?: string; done: boolean }

function taskLabel(task: Task): string {
  return (task.t ?? task.title ?? '').trim()
}

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
  tasks?: Task[]
  requirements?: string[]
}

function addMonths(iso: string, m: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setMonth(d.getMonth() + m)
  return d.toISOString().slice(0, 10)
}

export function OnboardingPage() {
  const { user } = useAuth()
  const canEdit = !!user?.canEditData
  const [items, setItems] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<Plan> & {
    tasksText?: string
    reqText?: string
  } | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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
    const res = await fetchJson<{ plan: Plan }>(`/api/recruitment/onboarding/${id}`)
    const p = res.plan
    const tasks = (p.tasks as Task[]) ?? []
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
                rows={6}
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
      <div className="card empty">
        <h2>Onboarding</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Onboarding</h2>
        <p>{error}</p>
      </div>
    )
  }

  const dueCount = items.filter(
    (p) => p.remind_convert || p.status === 'due_convert',
  ).length

  return (
    <div className="card">
      <div className="toolbar">
        <div>
          <h2>Onboarding ({items.length})</h2>
          <p className="muted">
            {dueCount > 0
              ? `⚠ ${dueCount} người sắp/đã hết 3 tháng thử việc — cần chuyển hồ sơ NV chính thức.`
              : 'Theo dõi checklist & mốc chuyển chính thức sau thử việc.'}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const start = new Date().toISOString().slice(0, 10)
              setEditId(null)
              setEditing({
                full_name: '',
                role_title: '',
                department: 'Kỹ thuật',
                start_date: start,
                probation_end: addMonths(start, 3),
                status: 'in_progress',
                tasksText: [
                  '[ ] Ký hợp đồng thử việc / HĐLĐ',
                  '[ ] Thu hồ sơ (CCCD, bằng cấp, sổ BHXH)',
                  '[ ] Tạo email & tài khoản hệ thống',
                  '[ ] Cấp thiết bị làm việc',
                  '[ ] Orientation nội quy & văn hóa',
                  '[ ] Gặp QL — mục tiêu 30/60/90 ngày',
                  '[ ] Đăng ký BHXH / BHYT',
                  '[ ] Hoàn thành khóa đào tạo bắt buộc',
                ].join('\n'),
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
      {items.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Vị trí</th>
                <th>Phòng ban</th>
                <th>Bắt đầu</th>
                <th>Hết TV</th>
                <th>TT</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const due = p.remind_convert || p.status === 'due_convert'
                return (
                  <tr key={p.id} className={due ? 'row-warn' : undefined}>
                    <td>{p.full_name}</td>
                    <td>{p.role_title ?? '—'}</td>
                    <td>{p.department ?? '—'}</td>
                    <td>{p.start_date}</td>
                    <td>{p.probation_end ?? '—'}</td>
                    <td>
                      {due && p.status !== 'converted'
                        ? 'Cần chuyển chính thức'
                        : p.status}
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
  )
}
